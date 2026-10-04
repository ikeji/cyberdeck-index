// Scrapbox raw page -> Entry (純粋関数)
const URL_RE = /^https?:\/\/\S+$/;
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;
const MEMO_PLAIN_LINES = 6;

const SITES = [
  [/(^|\.)reddit\.com$|(^|\.)redd\.it$/, 'reddit'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, 'twitter'],
  [/(^|\.)github\.com$/, 'github'],
  [/(^|\.)hackaday\.(com|io)$/, 'hackaday'],
  [/(^|\.)instagram\.com$/, 'instagram'],
];
const POST_SITES = new Set(['reddit', 'youtube', 'twitter', 'instagram']);

export function siteOf(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return 'web'; }
  for (const [re, name] of SITES) if (re.test(host)) return name;
  if (host === 'scrapbox.io') return 'scrapbox';
  return 'web';
}

export function isImageUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.hostname === 'gyazo.com' || u.hostname === 'i.gyazo.com') return true;
  if (u.hostname === 'scrapbox.io' && u.pathname.startsWith('/files/')) return true;
  if (u.hostname === 'preview.redd.it' || u.hostname === 'i.redd.it') return true;
  return IMG_EXT.test(u.pathname + u.search);
}

export function imageRaw(url) {
  const u = new URL(url);
  if (u.hostname === 'gyazo.com' && /^\/[0-9a-f]{32}$/.test(u.pathname)) return `https://gyazo.com${u.pathname}/raw`;
  return url;
}

// "[url]" / "[url label]" / "[label url]" / "url" を {url,label} に。該当しなければ null
export function parseLinkLine(text) {
  const t = text.trim();
  if (URL_RE.test(t)) return { url: t, label: null };
  const m = t.match(/^\[(.+)\]$/);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/);
  if (URL_RE.test(parts[0])) return { url: parts[0], label: parts.slice(1).join(' ') || null };
  if (parts.length > 1 && URL_RE.test(parts[parts.length - 1])) return { url: parts[parts.length - 1], label: parts.slice(0, -1).join(' ') };
  return null;
}

const iso = (sec) => new Date(sec * 1000).toISOString();

export function extract(raw, project = 'CYBERDECK') {
  const lines = raw.lines.slice(1).map((l) => l.text);
  const images = [];
  const seenImg = new Set();
  const urls = []; // 画像以外の外部リンク候補
  const tags = [];
  const plain = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const link = parseLinkLine(t);
    if (link) {
      if (isImageUrl(link.url)) {
        if (!seenImg.has(link.url)) {
          seenImg.add(link.url);
          images.push({ origin: link.url, originRaw: imageRaw(link.url), status: 'pending' });
        }
      } else {
        urls.push({ url: link.url, label: link.label, site: siteOf(link.url) });
      }
      continue;
    }
    if (/^\[[^\[\]]+\]$/.test(t)) continue; // [ページ名] だけの行は related (raw.links) に任せる
    const tagMatches = [...t.matchAll(/(?:^|\s)#(\S+)/g)].map((m) => m[1]);
    tags.push(...tagMatches);
    const rest = t.replace(/(?:^|\s)#\S+/g, '').trim();
    if (tagMatches.length && !rest) continue; // タグだけの行
    plain.push(t);
  }

  const sourceCandidates = urls.filter((u) => u.site !== 'scrapbox');
  const source = sourceCandidates.find((u) => u.site === 'reddit') ?? sourceCandidates[0] ?? null;
  const uniqTags = [...new Set(tags)];
  const related = [...new Set(raw.links ?? [])].filter((l) => !uniqTags.includes(l));

  const memo = !source || plain.length >= MEMO_PLAIN_LINES;
  if (memo) return { memo: true, title: raw.title, id: raw.id, plainLines: plain.length, hasSource: !!source };

  const links = urls.filter((u) => u !== source).map(({ url, label, site }) => ({ url, label, site }));
  const entry = {
    schemaVersion: 1,
    id: raw.id,
    title: raw.title,
    source: { url: source.url, site: source.site, label: source.label },
    links,
    images,
    tags: uniqTags,
    related,
    comment: plain.length ? plain.join('\n') : null,
    scrapbox: {
      url: `https://scrapbox.io/${project}/${encodeURIComponent(raw.title)}`,
      created: iso(raw.created),
      updated: iso(raw.updated),
      views: raw.views ?? 0,
      thumbnail: raw.image ?? null,
    },
  };
  return { memo: false, entry };
}

export { POST_SITES };
