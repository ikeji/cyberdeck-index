// data/entries/*.json を JSON Schema で検証
import fs from 'node:fs/promises';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import { DATA, ROOT } from './common.mjs';

const schema = JSON.parse(await fs.readFile(path.join(ROOT, 'schema/entry.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);

const dir = path.join(DATA, 'entries');
let bad = 0, n = 0;
for (const f of (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))) {
  n++;
  const e = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
  if (!validate(e) || f !== `${e.id}.json`) {
    bad++;
    console.error(`INVALID ${f}:`, JSON.stringify(validate.errors));
  } else if (e.images.some((i) => i.status === 'ok') && !e.images.filter((i) => i.status === 'ok').every((i) => i.files)) {
    bad++;
    console.error(`INVALID ${f}: ok image without files`);
  }
}
console.log(`validated ${n} entries, ${bad} invalid`);
process.exit(bad ? 1 : 0);
