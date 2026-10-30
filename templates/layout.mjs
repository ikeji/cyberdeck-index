export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SITE_NAME = 'CYBERDECK Index';
export const SITE_DESC = 'A link collection of cyberdeck builds: links to the original posts and articles, with cached images.';

const SITE_LABEL = { reddit: 'Reddit', youtube: 'YouTube', twitter: 'X/Twitter', github: 'GitHub', hackaday: 'Hackaday', instagram: 'Instagram', web: 'Web' };
export const siteLabel = (s) => SITE_LABEL[s] ?? s;

export function layout({ base, title, desc, ogImage, path: pagePath = '', nav, body, scripts = [] }) {
  const full = title ? `${esc(title)} | ${SITE_NAME}` : SITE_NAME;
  const description = esc(desc ?? SITE_DESC);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-K14G32F0WZ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-K14G32F0WZ');
</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${full}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:title" content="${full}">
<meta property="og:description" content="${description}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n` : ''}<link rel="stylesheet" href="${base}static/style.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="${base}">${SITE_NAME}</a>
  <nav>${nav}</nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <a href="${base}about/">About this site</a>
</footer>
${scripts.map((s) => `<script src="${base}static/${s}"></script>`).join('\n')}
</body>
</html>
`;
}

export function card(e, base) {
  const img = e.images.find((i) => i.status === 'ok');
  const thumb = img
    ? `<img src="${base}${img.files.thumb}" width="${Math.min(img.width, 480)}" height="${Math.round(img.height * Math.min(1, 480 / Math.max(img.width, img.height)))}" loading="lazy" alt="">`
    : `<div class="noimg">no image</div>`;
  const n = e.images.filter((i) => i.status === 'ok').length;
  return `<a class="card" href="${base}e/${e.id}/" data-site="${esc(e.source.site)}" data-title="${esc(e.title.toLowerCase())}">
  <div class="thumb">${thumb}</div>
  <div class="meta"><span class="badge badge-${esc(e.source.site)}">${esc(siteLabel(e.source.site))}</span>${n > 1 ? `<span class="count">${n} images</span>` : ''}</div>
  <h3>${esc(e.title)}</h3>
</a>`;
}
