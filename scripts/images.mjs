// data/entries の images を取得 -> data/images/{hh}/{sha256}.webp (+ .thumb.webp)
// 使い方: node scripts/images.mjs [--retry-missing]
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA, sleep } from './common.mjs';
import { cacheImage } from './images-lib.mjs';

const ENTRIES = path.join(DATA, 'entries');
const CONCURRENCY = 2;
const DELAY_MS = 500;
const retryMissing = process.argv.includes('--retry-missing');

const todo = (img) => img.status === 'pending' || img.status === 'error' || (retryMissing && img.status === 'missing');

const files = (await fs.readdir(ENTRIES)).filter((f) => f.endsWith('.json'));
const queue = [];
for (const f of files) {
  const entry = JSON.parse(await fs.readFile(path.join(ENTRIES, f), 'utf8'));
  if (entry.images.some(todo)) queue.push(f);
}
console.log(`entries with images to fetch: ${queue.length}`);

const stats = { ok: 0, missing: 0, error: 0 };
let done = 0;
// 1エントリを1ワーカーが担当し、完了ごとに書き戻す (競合なし・途中で止まっても進捗が残る)
async function worker() {
  while (queue.length) {
    const f = queue.shift();
    const p = path.join(ENTRIES, f);
    const entry = JSON.parse(await fs.readFile(p, 'utf8'));
    for (let i = 0; i < entry.images.length; i++) {
      const img = entry.images[i];
      if (!todo(img)) continue;
      let r;
      try { r = await cacheImage(img, { retries: 5 }); }
      catch (e) { r = { status: 'error' }; console.error(`error ${img.originRaw}: ${e.message}`); }
      stats[r.status]++;
      const { note, ...rest } = r;
      entry.images[i] = { origin: img.origin, originRaw: img.originRaw, ...rest };
      await sleep(DELAY_MS);
    }
    await fs.writeFile(p, JSON.stringify(entry, null, 2) + '\n');
    if (++done % 25 === 0) console.log(`${done} entries`, stats);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log('done', stats);
// 取得失敗 (error) は次回の実行で再試行するため、デプロイは止めない
if (stats.error) console.warn(`warning: ${stats.error} images failed; they will be retried on the next run`);
