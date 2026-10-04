import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = path.join(ROOT, 'data');
export const PROJECT = 'CYBERDECK';
export const UA = 'Mozilla/5.0 (compatible; cyberdeck-index/1.0; +https://scrapbox.io/CYBERDECK/)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getWithRetry(url, { retries = 3, as = 'json' } = {}) {
  let last;
  for (let i = 0; i < retries; i++) {
    let wait = 500 * (i + 1);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (res.status === 404 || res.status === 403 || res.status === 410) return { status: res.status, body: null };
      if (res.status === 429 || res.status === 503) {
        wait = Number(res.headers.get('retry-after')) * 1000 || 3000 * 2 ** i; // レート制限は長めに待つ
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = as === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer());
      return { status: res.status, body, headers: res.headers };
    } catch (e) {
      last = e;
      if (i < retries - 1) await sleep(wait);
    }
  }
  throw new Error(`${url}: ${last?.message}`);
}
