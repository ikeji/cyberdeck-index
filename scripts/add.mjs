// 使い方: npm run add -- <url> [--title T] [--tag x]... [--comment C] [--image <URL|ファイル>]...
import fs from 'node:fs/promises';
import { addEntry, fetchMeta } from './add-lib.mjs';

const args = process.argv.slice(2);
const opt = { tag: [], image: [] };
let url;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--title' || a === '--comment') opt[a.slice(2)] = args[++i];
  else if (a === '--tag' || a === '--image') opt[a.slice(2)].push(args[++i]);
  else if (a.startsWith('--')) { console.error(`unknown option: ${a}`); process.exit(1); }
  else url = a;
}
if (!url) { console.error('usage: npm run add -- <url> [--title T] [--tag x]... [--comment C] [--image <URL|file>]...'); process.exit(1); }

let { title, image: imgs } = opt;
if (!title || !imgs.length) {
  const meta = await fetchMeta(url).catch((e) => ({ title: '', images: [], note: e.message }));
  if (meta.note) console.warn(`note: ${meta.note}`);
  title ||= meta.title;
  if (!imgs.length) imgs = meta.images;
}

const images = [];
for (const v of imgs) images.push(/^https?:/.test(v) ? { url: v } : { buffer: await fs.readFile(v) });

const r = await addEntry({ url, title, tags: opt.tag, comment: opt.comment, images });
console.log(`${r.created ? 'created' : 'updated'}: ${r.entry.title}\n  id: ${r.entry.id}\n  images: ${r.added.map((i) => i.status).join(', ') || '(none added)'}`);
if (r.added.some((i) => i.status !== 'ok')) console.log('  (failed images can be retried with: npm run images)');
