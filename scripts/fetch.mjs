// Scrapbox API -> data/raw/*.json (差分取得)
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA, PROJECT, getWithRetry, sleep } from './common.mjs';

const RAW = path.join(DATA, 'raw');
const api = (p) => `https://scrapbox.io/api/pages/${PROJECT}${p}`;

await fs.mkdir(RAW, { recursive: true });

const { body: list } = await getWithRetry(api('?limit=1000'));
if (!list || !Array.isArray(list.pages)) throw new Error('unexpected list response');
if (list.count > list.pages.length) throw new Error(`list truncated: ${list.pages.length}/${list.count}`);

await fs.writeFile(path.join(RAW, '_list.json'), JSON.stringify(list.pages));

let fetched = 0;
for (const p of list.pages) {
  const file = path.join(RAW, `${p.id}.json`);
  try {
    const cur = JSON.parse(await fs.readFile(file, 'utf8'));
    if (cur.updated === p.updated) continue;
  } catch {}
  const { body } = await getWithRetry(api(`/${encodeURIComponent(p.title)}`));
  if (!body || !Array.isArray(body.lines)) throw new Error(`unexpected page response: ${p.title}`);
  await fs.writeFile(file, JSON.stringify(body));
  fetched++;
  await sleep(200);
}

// 一覧から消えたページの raw を削除
const ids = new Set(list.pages.map((p) => p.id));
for (const f of await fs.readdir(RAW)) {
  if (f.endsWith('.json') && f !== '_list.json' && !ids.has(f.slice(0, -5))) await fs.rm(path.join(RAW, f));
}
console.log(`pages: ${list.pages.length}, fetched: ${fetched}`);
