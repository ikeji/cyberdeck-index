// エントリ内の URL (source.url, links[].url, images[], scrapbox.url) の妥当性検証
const ILLEGAL_URL_CHARS = /[\s\x00-\x1F\x7F\[\]<>"{}|\\^`]/;
const SECOND_HTTP = /^https?:\/\/.+https?:\/\//i;

export function validateHttpUrl(url) {
  if (typeof url !== 'string' || !url) return 'must be a non-empty string';
  if (ILLEGAL_URL_CHARS.test(url)) return 'contains disallowed character (whitespace, bracket, etc.)';
  if (SECOND_HTTP.test(url)) return 'contains a second http(s) URL';
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'failed to parse as URL';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'protocol must be http or https';
  if (!u.hostname) return 'missing hostname';
  if (/%5[bd]/i.test(u.pathname)) return 'contains percent-encoded bracket in path';
  if (/https?%3a%2f%2f/i.test(u.pathname)) return 'contains percent-encoded second http(s) URL in path';
  return null;
}

export function validateEntryUrls(entry) {
  const errors = [];
  const srcErr = validateHttpUrl(entry?.source?.url);
  if (srcErr) errors.push(`source.url (${entry?.source?.url}): ${srcErr}`);
  for (const [i, l] of (entry?.links ?? []).entries()) {
    const err = validateHttpUrl(l?.url);
    if (err) errors.push(`links[${i}].url (${l?.url}): ${err}`);
  }
  for (const [i, img] of (entry?.images ?? []).entries()) {
    for (const key of ['origin', 'originRaw']) {
      const val = img?.[key];
      if (typeof val === 'string' && /^local:[0-9a-f]{64}$/.test(val)) continue;
      const err = validateHttpUrl(val);
      if (err) errors.push(`images[${i}].${key} (${val}): ${err}`);
    }
  }
  if (entry?.scrapbox?.url !== undefined) {
    const err = validateHttpUrl(entry.scrapbox.url);
    if (err) errors.push(`scrapbox.url (${entry.scrapbox.url}): ${err}`);
  }
  return errors;
}
