import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const enPath = join(root, 'locales', 'en.json');
const en = JSON.parse(readFileSync(enPath, 'utf8'));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(p);
  }
};
walk(join(root, 'app'));
walk(join(root, 'lib'));

const re = /\bt\(\s*'([^']+)'\s*\)/g; // word-boundary skips false positives like closest('.fa-bell')
let added = 0;
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(re)) {
    const key = m[1].trim();
    if (!key || key.startsWith('.') || key.includes('/')) continue;
    if (!(key in en)) { en[key] = key; added++; }
  }
}
writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
console.log(`✅ Added ${added} missing keys to locales/en.json`);
