import { esc, siteLabel, SITE_NAME, SITE_DESC } from '../templates/layout.mjs';

const cleanXml = (s) => String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
const xmlEsc = (s) => esc(cleanXml(s));

export const rfc822 = (iso) => {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : new Date(t).toUTCString();
};

const entryDate = (e) => e.addedAt ?? e.scrapbox?.updated ?? '';

export function buildRss(entries, { siteUrl, base = '/', limit = 50 }) {
  const prefix = `${siteUrl.replace(/\/$/, '')}${base.endsWith('/') ? base : `${base}/`}`;
  const abs = (rel) => `${prefix}${rel}`;
  const items = entries.slice(0, limit);
  const lastBuildDate = items.length ? rfc822(entryDate(items[0])) : undefined;

  const itemsXml = items.map((e) => {
    const link = abs(`e/${e.id}/`);
    const pubDate = rfc822(entryDate(e));
    const img = e.images.find((i) => i.status === 'ok');
    const descParts = [];
    if (img) descParts.push(`<p><a href="${xmlEsc(link)}"><img src="${xmlEsc(abs(img.files.thumb))}" alt="${xmlEsc(e.title)}"></a></p>`);
    if (e.comment) descParts.push(`<p>${xmlEsc(e.comment)}</p>`);
    descParts.push(`<p><a href="${xmlEsc(e.source.url)}">View original → ${xmlEsc(siteLabel(e.source.site))}</a></p>`);
    const cats = [siteLabel(e.source.site), ...(e.tags ?? [])]
      .map((c) => `<category>${xmlEsc(c)}</category>`)
      .join('');

    return `    <item>
      <title>${xmlEsc(e.title)}</title>
      <link>${xmlEsc(link)}</link>
      <guid isPermaLink="true">${xmlEsc(link)}</guid>
${pubDate ? `      <pubDate>${pubDate}</pubDate>\n` : ''}${cats ? `      ${cats}\n` : ''}      <description>${xmlEsc(descParts.join(''))}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEsc(SITE_NAME)}</title>
    <link>${xmlEsc(abs(''))}</link>
    <description>${xmlEsc(SITE_DESC)}</description>
    <language>en</language>
${lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` : ''}    <atom:link href="${xmlEsc(abs('rss.xml'))}" rel="self" type="application/rss+xml"/>
${itemsXml ? `${itemsXml}\n` : ''}  </channel>
</rss>
`;
}
