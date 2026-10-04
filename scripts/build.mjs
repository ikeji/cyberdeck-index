// data/entries + content/*.md -> dist/
import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { DATA, ROOT } from './common.mjs';
import { layout, card, esc, siteLabel, SITE_NAME } from '../templates/layout.mjs';

const DIST = path.join(ROOT, 'dist');
let BASE = process.env.BASE_URL ?? '/';
if (!BASE.endsWith('/')) BASE += '/';
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, ''); // OGP 用の絶対URL (任意)

const readJson = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const write = async (rel, content) => {
  const f = path.join(DIST, rel);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, content);
};
const tagDir = (t) => t.replace(/[\/\\?#%]/g, '_');
const tagUrl = (t) => `${BASE}tags/${encodeURIComponent(tagDir(t))}/`;

// ---- load ----
const takedown = new Set(await readJson(path.join(DATA, 'takedown.json')).catch(() => []));
const entries = [];
for (const f of (await fs.readdir(path.join(DATA, 'entries'))).filter((f) => f.endsWith('.json'))) {
  const e = await readJson(path.join(DATA, 'entries', f));
  if (!takedown.has(e.id)) entries.push(e);
}
const sortKey = (e) => e.addedAt ?? e.scrapbox?.updated ?? '';
entries.sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
const byTitle = new Map(entries.map((e) => [e.title, e]));

async function loadMarkdown(file) {
  const raw = await fs.readFile(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
    }
  }
  return { meta, html: marked.parse(body) };
}
const about = await loadMarkdown(path.join(ROOT, 'content/about.md'));
const notes = [];
try {
  for (const f of (await fs.readdir(path.join(ROOT, 'content/notes'))).filter((f) => f.endsWith('.md'))) {
    const n = await loadMarkdown(path.join(ROOT, 'content/notes', f));
    notes.push({ slug: n.meta.slug ?? f.replace(/\.md$/, ''), title: n.meta.title ?? f, order: Number(n.meta.order ?? 100), html: n.html });
  }
} catch {}
notes.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

const nav = [
  `<a href="${BASE}">Index <span class="nav-count">(${entries.length} decks)</span></a>`,
  `<a href="${BASE}tags/">Tags</a>`,
  notes.length ? `<a href="${BASE}notes/">Notes</a>` : '',
  `<a href="${BASE}search/">Search</a>`,
  `<a href="${BASE}about/">About</a>`,
].join('');
const page = (o) => layout({ base: BASE, nav, ...o });
const abs = (rel) => (SITE_URL ? `${SITE_URL}${BASE}${rel}` : undefined);

await fs.rm(DIST, { recursive: true, force: true });

// ---- index ----
const sites = [...new Set(entries.map((e) => e.source.site))].sort((a, b) => entries.filter((e) => e.source.site === b).length - entries.filter((e) => e.source.site === a).length);
await write('index.html', page({
  body: `<h1>${SITE_NAME}</h1>
<div class="toolbar">
  <input type="search" id="q" placeholder="Filter by title" aria-label="Filter by title">
  <button class="chip" data-site="" aria-pressed="true">All</button>
  ${sites.map((s) => `<button class="chip" data-site="${esc(s)}" aria-pressed="false">${esc(siteLabel(s))}</button>`).join('\n  ')}
  <span id="count">${entries.length} decks</span>
</div>
<div class="grid">
${entries.map((e) => card(e, BASE)).join('\n')}
</div>`,
  scripts: ['filter.js'],
}));

// ---- entries ----
for (const e of entries) {
  const imgs = e.images.filter((i) => i.status === 'ok');
  const missing = e.images.length - imgs.length;
  const ext = [e.source, ...(e.links ?? [])];
  const rel = (e.related ?? []).map((t) => {
    const hit = byTitle.get(t);
    return hit ? `<a href="${BASE}e/${hit.id}/">${esc(t)}</a>` : esc(t);
  });
  const body = `<h1>${esc(e.title)}</h1>
<p><a class="source-btn" href="${esc(e.source.url)}" rel="noopener noreferrer">View original → ${esc(siteLabel(e.source.site))}</a></p>
<div class="gallery">
${imgs.map((i) => `<a href="${BASE}${i.files.full}"><img src="${BASE}${i.files.full}" width="${i.width}" height="${i.height}" loading="lazy" alt=""></a>`).join('\n')}
</div>
${missing ? `<p><small>${missing} image(s) could not be fetched.</small></p>` : ''}
${e.comment ? `<p class="comment">${esc(e.comment)}</p>` : ''}
<dl class="dl">
${e.tags.length ? `<dt>Tags</dt><dd class="tags">${e.tags.map((t) => `<a href="${tagUrl(t)}">#${esc(t)}</a>`).join('')}</dd>` : ''}
${rel.length ? `<dt>Related</dt><dd>${rel.join(' / ')}</dd>` : ''}
<dt>Links</dt><dd>${ext.map((l) => `<a href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.label || l.url)}</a>`).join('<br>')}</dd>
${e.scrapbox ? `<dt>Scrapbox</dt><dd><a href="${esc(e.scrapbox.url)}" rel="noopener noreferrer">${esc(e.scrapbox.url)}</a>(updated ${esc(e.scrapbox.updated.slice(0, 10))})</dd>` : ''}
</dl>`;
  await write(`e/${e.id}/index.html`, page({
    title: e.title, desc: e.comment ?? `Link to the original ${siteLabel(e.source.site)} post`, ogImage: imgs[0] && abs(imgs[0].files.thumb), body,
  }));
}

// ---- tags ----
const tagMap = new Map();
for (const e of entries) for (const t of e.tags) (tagMap.get(t) ?? tagMap.set(t, []).get(t)).push(e);
await write('tags/index.html', page({
  title: 'Tags',
  body: `<h1>Tags</h1><p class="tags">${[...tagMap].sort((a, b) => b[1].length - a[1].length).map(([t, es]) => `<a href="${tagUrl(t)}">#${esc(t)} (${es.length})</a>`).join('')}</p>${tagMap.size ? '' : '<p>No tags.</p>'}`,
}));
for (const [t, es] of tagMap) {
  await write(`tags/${tagDir(t)}/index.html`, page({ title: `#${t}`, body: `<h1>#${esc(t)}</h1><div class="grid">${es.map((e) => card(e, BASE)).join('\n')}</div>` }));
}

// ---- notes / about ----
if (notes.length) {
  await write('notes/index.html', page({ title: 'Notes', body: `<h1>Notes</h1><ul class="results">${notes.map((n) => `<li><a href="${BASE}notes/${encodeURIComponent(n.slug)}/">${esc(n.title)}</a></li>`).join('')}</ul>` }));
  for (const n of notes) await write(`notes/${n.slug}/index.html`, page({ title: n.title, body: `<article class="prose">${n.html}</article>` }));
}
await write('about/index.html', page({ title: about.meta.title, body: `<article class="prose">${about.html}</article>` }));
await write('404.html', page({ title: 'Not found', body: `<h1>Page not found</h1><p><a href="${BASE}">Back to index</a></p>` }));

// ---- search ----
await write('search/index.html', page({
  title: 'Search',
  body: `<div id="app" data-base="${BASE}"><h1>Search</h1><div class="toolbar"><input type="search" id="q" placeholder="Keyword" aria-label="Keyword" autofocus></div><ul class="results" id="results"></ul></div>`,
  scripts: ['minisearch.js', 'search.js'],
}));
const docs = [
  ...entries.map((e) => ({ id: `e:${e.id}`, title: e.title, text: [...e.tags, ...e.related, e.comment ?? '', e.source.label ?? '', e.source.site].join(' '), url: `e/${e.id}/`, site: siteLabel(e.source.site) })),
  ...notes.map((n) => ({ id: `n:${n.slug}`, title: n.title, text: n.html.replace(/<[^>]+>/g, ' '), url: `notes/${encodeURIComponent(n.slug)}/`, site: 'Notes' })),
];
await write('search-index.json', JSON.stringify(docs));

// ---- Cloudflare Pages: キャッシュヘッダ (画像は内容ハッシュ名なので immutable) ----
await write('_headers', `/img/*
  Cache-Control: public, max-age=31536000, immutable
/static/*
  Cache-Control: public, max-age=3600
`);

// ---- static / images ----
await fs.cp(path.join(ROOT, 'static'), path.join(DIST, 'static'), { recursive: true });
await fs.copyFile(path.join(ROOT, 'node_modules/minisearch/dist/umd/index.js'), path.join(DIST, 'static/minisearch.js'));
const used = new Set(entries.flatMap((e) => e.images.filter((i) => i.status === 'ok').flatMap((i) => [i.files.thumb, i.files.full])));
let copied = 0;
for (const rel of used) {
  const src = path.join(DATA, 'images', rel.replace(/^img\//, ''));
  try { await fs.mkdir(path.dirname(path.join(DIST, rel)), { recursive: true }); await fs.copyFile(src, path.join(DIST, rel)); copied++; }
  catch { console.warn(`missing cached file: ${rel}`); }
}
console.log(`built: ${entries.length} entries, ${tagMap.size} tags, ${notes.length} notes, ${copied} image files`);
