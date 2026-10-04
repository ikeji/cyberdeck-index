// ブックマークレットから登録するためのローカルサーバ (127.0.0.1 のみ)
// 使い方: npm run add-server  -> http://localhost:8787/
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './common.mjs';
import { addEntry, fetchMeta, findBySource } from './add-lib.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = '127.0.0.1';
const ORIGINS = new Set([`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]);
const MAX_BODY = 60 * 1024 * 1024;

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function bookmarkletHref() {
  const src = await fs.readFile(path.join(ROOT, 'tools/bookmarklet.js'), 'utf8');
  const code = src.split('\n').map((l) => l.trim()).filter(Boolean).join('').replace('__ORIGIN__', `http://localhost:${PORT}`);
  return 'javascript:' + encodeURIComponent(code);
}

async function home() {
  const href = await bookmarkletHref();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Add tool | CYBERDECK Index</title><link rel="stylesheet" href="/style.css"></head><body>
<header class="site-header"><a class="brand" href="/">CYBERDECK Index / Add tool</a></header>
<main class="prose">
<h1>Add tool</h1>
<p>Drag the link below to your bookmarks bar.</p>
<p><a class="source-btn" id="bm" href="${href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">+ Add to CYBERDECK</a></p>
<p>Open a post on Reddit, YouTube, X or any website and click the bookmark. A confirmation page opens; adjust the title and tags, then press Save.</p>
<p><a href="/add">Add manually</a></p>
<p><small>This server runs only while <code>npm run add-server</code> is running. After saving, run <code>npm run build</code> to publish.</small></p>
</main></body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    // DNS rebinding 対策: Host を localhost 系に限定
    const host = req.headers.host ?? '';
    if (![...ORIGINS].some((o) => o.endsWith(`//${host}`))) return send(res, 403, { error: 'bad host' });
    const url = new URL(req.url, `http://${host}`);

    if (req.method === 'GET') {
      if (url.pathname === '/') return send(res, 200, await home(), 'text/html; charset=utf-8');
      if (url.pathname === '/add') return send(res, 200, await fs.readFile(path.join(ROOT, 'tools/add.html')), 'text/html; charset=utf-8');
      if (url.pathname === '/style.css') return send(res, 200, await fs.readFile(path.join(ROOT, 'static/style.css')), 'text/css; charset=utf-8');
      if (url.pathname === '/api/lookup') {
        const u = url.searchParams.get('url') ?? '';
        const e = /^https?:/.test(u) ? await findBySource(u).catch(() => null) : null;
        return send(res, 200, e ? { exists: true, title: e.title, images: e.images.length } : { exists: false });
      }
      if (url.pathname === '/api/meta') {
        const u = url.searchParams.get('url') ?? '';
        if (!/^https?:/.test(u)) return send(res, 400, { error: 'invalid url' });
        return send(res, 200, await fetchMeta(u).catch((e) => ({ title: '', images: [], note: e.message })));
      }
      return send(res, 404, { error: 'not found' });
    }

    if (req.method === 'POST' && url.pathname === '/api/add') {
      // CSRF 対策: 他サイトからの送信を拒否 (JSON は preflight が必要 + Origin 検証)
      const origin = req.headers.origin;
      if (!origin || !ORIGINS.has(origin)) return send(res, 403, { error: 'bad origin' });
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'json only' });
      const body = JSON.parse((await readBody(req)).toString('utf8'));
      const images = (body.images ?? []).map((i) => {
        if (i.dataUrl) {
          const m = String(i.dataUrl).match(/^data:image\/[\w.+-]+;base64,(.+)$/s);
          if (!m) throw new Error('invalid image data');
          return { buffer: Buffer.from(m[1], 'base64') };
        }
        return { url: String(i.url) };
      });
      const r = await addEntry({ url: body.url, title: body.title, tags: body.tags, comment: body.comment, images });
      console.log(`${r.created ? 'created' : 'updated'}: ${r.entry.title} (${r.added.map((i) => i.status).join(',') || 'no images'})`);
      return send(res, 200, { created: r.created, id: r.entry.id, title: r.entry.title, added: r.added });
    }
    return send(res, 405, { error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    send(res, 400, { error: e.message });
  }
});

server.listen(PORT, HOST, () => console.log(`add-server: http://localhost:${PORT}/`));
