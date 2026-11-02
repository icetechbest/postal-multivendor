#!/usr/bin/env node
/**
 * Copy the shared GraphQL documents into the app.
 *
 * The canonical source lives in `packages/graphql-docs` so the web console and
 * the mobile app never drift apart. The app keeps a vendored copy in
 * `lib/graphql-docs` because EAS Build / CI check out only this folder (there is
 * no monorepo sibling available there).
 *
 * Run `npm run sync:docs` after changing the shared package, then commit.
 */
const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../../packages/graphql-docs/src/index.ts');
const target = path.resolve(__dirname, '../lib/graphql-docs/index.ts');

if (!fs.existsSync(source)) {
  console.error(`Shared package not found at ${source}`);
  console.error('Nothing to sync — the vendored copy in lib/graphql-docs is used as-is.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
const banner = '// AUTO-GENERATED from packages/graphql-docs/src/index.ts — run `npm run sync:docs`.\n';
fs.writeFileSync(target, banner + fs.readFileSync(source, 'utf8'));
console.log(`Synced ${path.relative(process.cwd(), target)}`);
