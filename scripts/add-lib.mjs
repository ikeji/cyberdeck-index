// エントリの手動登録 (CLI / ブックマークレット用サーバ共通)
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA, UA, getWithRetry } from './common.mjs';
import { siteOf, isImageUrl, imageRaw } from './extract-lib.mjs';
import { cacheImage, storeBuffer } from './images-lib.mjs';

const ENTRIES = path.join(DATA, 'entries');
const TRACKING = /^(utm_.+|fbclid|gclid|igshid|ref|ref_src|ref_url|share_id|\$deep_link|correlation_id|context)$/i;

// 重複判定用に URL を正規化する
export function normalizeUrl(input) {
  const u = new URL(input.trim());
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  if (/(^|\.)reddit\.com$/.test(u.hostname)) {
    u.hostname = 'www.reddit.com';
    u.search = '';
    if (!u.pathname.endsWith('/')) u.pathname += '/';
  } else if (/^(www\.)?(twitter|x)\.com$/.test(u.hostname) || u.hostname === 'youtu.be' || /(^|\.)youtube\.com$/.test(u.hostname)) {
    // twitter: クエリ全削除 / youtube: v だけ残す
    const v = u.searchParams.get('v');
    u.search = '';
    if (v) u.searchParams.set('v', v);
  } else {
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  }
  return u.toString();
}

export const makeId = (url) => crypto.createHash('sha1').update(normalizeUrl(url)).digest('hex').slice(0, 24);

export function parseTags(v) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(/[,\s]+/);
  return [...new Set(list.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean))];
}

// ---- メタ情報の取得 (サーバ側 / Reddit・X はログイン壁があるため対象外) ----
const decode = (s) => s.replace(/&(#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos);/gi, (m, _a, hex, dec, name) => {
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  if (dec) return String.fromCodePoint(Number(dec));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[m.slice(1, -1).toLowerCase()] ?? m;
});

export function parseMeta(html, baseUrl) {
  const meta = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const val = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
    if (key && val && !(key in meta)) meta[key] = decode(val[1] ?? val[2]);
  }
  const title = meta['og:title'] ?? meta['twitter:title'] ?? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const imgs = [meta['og:image'], meta['twitter:image']].filter(Boolean).map((u) => new URL(u, baseUrl).toString());
  return { title: title.trim(), images: [...new Set(imgs)] };
}

export function youtubeId(url) {
  const u = new URL(url);
  if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
  if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null;
  return null;
}

export async function fetchMeta(url) {
  const site = siteOf(url);
  if (site === 'reddit' || site === 'twitter') return { title: '', images: [], note: `${site} cannot be fetched automatically (use the bookmarklet)` };
  const id = youtubeId(url);
  if (id) {
    const o = await getWithRetry(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`).catch(() => ({}));
    return { title: o.body?.title ?? '', images: [`https://img.youtube.com/vi/${id}/maxresdefault.jpg`] };
  }
  const res = await getWithRetry(url, { as: 'buffer' });
  if (!res.body) return { title: '', images: [], note: `HTTP ${res.status}` };
  return parseMeta(res.body.toString('utf8'), url);
}

// ---- 画像 ----
async function cacheOne(url) {
  const img = { origin: url, originRaw: imageRaw(url), status: 'pending' };
  let r;
  try {
    r = await cacheImage(img);
    // YouTube の maxresdefault が無い動画は hqdefault にフォールバック
    if (r.status === 'missing' && /img\.youtube\.com\/vi\/[^/]+\/maxresdefault\.jpg$/.test(url)) {
      r = await cacheImage({ originRaw: url.replace('maxresdefault', 'hqdefault') });
    }
  } catch { r = { status: 'error' }; }
  const { note, ...rest } = r;
  return { ...img, ...rest };
}

async function cacheUpload(buf) {
  const r = await storeBuffer(buf);
  const ref = `local:${r.id.slice('sha256:'.length)}`;
  return { origin: ref, originRaw: ref, ...r };
}

export async function findBySource(url) {
  const id = makeId(url);
  const norm = normalizeUrl(url);
  for (const f of (await fs.readdir(ENTRIES)).filter((f) => f.endsWith('.json'))) {
    const e = JSON.parse(await fs.readFile(path.join(ENTRIES, f), 'utf8'));
    if (e.id === id) return e;
    try { if (normalizeUrl(e.source.url) === norm) return e; } catch {}
  }
  return null;
}

/**
 * エントリを登録 (同じ source URL があれば更新)
 * @param {{url:string,title?:string,tags?:string|string[],comment?:string,
 *          images?:Array<{url:string}|{buffer:Buffer}>}} input
 */
export async function addEntry(input) {
  const url = normalizeUrl(input.url);
  if (!/^https?:/.test(url)) throw new Error('URL must be http(s)');
  const existing = await findBySource(url);
  const title = (input.title ?? '').trim() || existing?.title;
  if (!title) throw new Error('Title is required');

  const have = new Set((existing?.images ?? []).map((i) => i.origin));
  const added = [];
  for (const im of input.images ?? []) {
    if (im.buffer) {
      const img = await cacheUpload(im.buffer);
      if (!have.has(img.origin)) { have.add(img.origin); added.push(img); }
    } else if (im.url && /^https?:/.test(im.url) && !have.has(im.url)) {
      have.add(im.url);
      added.push(await cacheOne(im.url));
    }
  }

  const now = new Date().toISOString();
  const entry = existing
    ? { ...existing, title, images: [...existing.images, ...added], tags: [...new Set([...existing.tags, ...parseTags(input.tags)])], comment: input.comment?.trim() || existing.comment }
    : {
        schemaVersion: 1,
        id: makeId(url),
        title,
        source: { url, site: siteOf(url), label: null },
        links: [],
        images: added,
        tags: parseTags(input.tags),
        related: [],
        comment: input.comment?.trim() || null,
        addedAt: now,
      };
  const file = path.join(ENTRIES, `${entry.id}.json`);
  await fs.mkdir(ENTRIES, { recursive: true });
  await fs.writeFile(file, JSON.stringify(entry, null, 2) + '\n');
  return { entry, created: !existing, added: added.map((i) => ({ origin: i.origin, status: i.status })), file };
}

export { isImageUrl };
