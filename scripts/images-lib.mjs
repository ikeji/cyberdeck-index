// 画像キャッシュ: 取得 -> sha256 -> WebP (thumb/full) -> data/images
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { DATA, getWithRetry } from './common.mjs';

const IMAGES = path.join(DATA, 'images');
const exists = (f) => fs.access(f).then(() => true, () => false);

// バイト列をキャッシュに保存し、Entry.images 用のメタ情報を返す
export async function storeBuffer(buf) {
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const dir = path.join(IMAGES, hash.slice(0, 2));
  const full = `${hash}.webp`, thumb = `${hash}.thumb.webp`;
  await fs.mkdir(dir, { recursive: true });

  const base = () => sharp(buf, { failOn: 'none' }).rotate();
  let width, height;
  if (!(await exists(path.join(dir, full)))) {
    const out = await base().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    await fs.writeFile(path.join(dir, full), out.data);
    ({ width, height } = out.info);
  } else {
    ({ width, height } = await sharp(path.join(dir, full)).metadata());
  }
  if (!(await exists(path.join(dir, thumb)))) {
    await base().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(dir, thumb));
  }
  return {
    id: `sha256:${hash}`,
    status: 'ok',
    width, height,
    mime: 'image/webp',
    files: { thumb: `img/${hash.slice(0, 2)}/${thumb}`, full: `img/${hash.slice(0, 2)}/${full}` },
    fetchedAt: new Date().toISOString(),
  };
}

// img = { originRaw } を取得して保存。取得できなければ { status: 'missing' }
export async function cacheImage(img, { retries = 3 } = {}) {
  const res = await getWithRetry(img.originRaw, { as: 'buffer', retries });
  if (!res.body) return { status: 'missing' };
  const ctype = res.headers?.get('content-type') ?? '';
  if (!ctype.startsWith('image/')) return { status: 'missing', note: ctype };
  return storeBuffer(res.body);
}
