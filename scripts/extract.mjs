// data/raw/*.json -> data/entries/*.json (+ data/memo-candidates.txt)
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA } from './common.mjs';
import { extract } from './extract-lib.mjs';

const RAW = path.join(DATA, 'raw');
const OUT = path.join(DATA, 'entries');
await fs.mkdir(OUT, { recursive: true });

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const files = (await fs.readdir(RAW)).filter((f) => f.endsWith('.json') && f !== '_list.json');

const keep = new Set();
const memos = [];
let written = 0;
for (const f of files) {
  const raw = await readJson(path.join(RAW, f));
  const res = extract(raw);
  if (res.memo) {
    memos.push(`${res.title}\t(plain=${res.plainLines}, source=${res.hasSource})`);
    continue;
  }
  const { entry } = res;
  const outFile = path.join(OUT, `${entry.id}.json`);
  // 取得済みの画像キャッシュ情報を引き継ぐ
  try {
    const prev = await readJson(outFile);
    const prevByOrigin = new Map(prev.images.map((i) => [i.origin, i]));
    entry.images = entry.images.map((i) => prevByOrigin.get(i.origin) ?? i);
  } catch {}
  const text = JSON.stringify(entry, null, 2) + '\n';
  let old = null;
  try { old = await fs.readFile(outFile, 'utf8'); } catch {}
  if (old !== text) { await fs.writeFile(outFile, text); written++; }
  keep.add(`${entry.id}.json`);
}

// raw から消えた/メモに変わったエントリを削除
// (Scrapbox 由来のものだけ。手動追加 = scrapbox なし のエントリは残す)
for (const f of await fs.readdir(OUT)) {
  if (!f.endsWith('.json') || keep.has(f)) continue;
  const e = await readJson(path.join(OUT, f));
  if (e.scrapbox) await fs.rm(path.join(OUT, f));
}

memos.sort();
await fs.writeFile(path.join(DATA, 'memo-candidates.txt'), memos.join('\n') + '\n');
console.log(`entries: ${keep.size} (written ${written}), memo candidates: ${memos.length}`);
