import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { DocumentNode, OperationDefinitionNode, parse, validate } from 'graphql';
import { resolvers } from '../src/graphql/resolvers';
import { typeDefs } from '../src/graphql/typeDefs';

const adminDir = resolve(process.cwd(), process.env.ADMIN_DIR || '../postal-multivendor-admin');
const gqlRoot = join(adminDir, 'lib/api/graphql');
const schema = makeExecutableSchema({ typeDefs, resolvers });

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx|js|jsx)$/.test(entry) ? [full] : [];
  });

interface Template {
  exportName: string;
  source: string;
}

// Finds every `export const NAME = gql`...`` (a file may export several operations).
const templatesOf = (source: string): Template[] => {
  const out: Template[] = [];
  const pattern = /export\s+const\s+(\w+)\s*=\s*(?:gql\s*)?`([\s\S]*?)`/g;
  for (const match of source.matchAll(pattern)) out.push({ exportName: match[1], source: match[2] });
  return out;
};

const isOperation = (d: unknown): d is OperationDefinitionNode =>
  (d as OperationDefinitionNode).kind === 'OperationDefinition';

let checked = 0;
let failed = 0;
const byFile = new Map<string, string[]>();
const add = (file: string, message: string) => {
  failed += 1;
  byFile.set(file, [...(byFile.get(file) || []), message]);
};

for (const file of walk(gqlRoot).sort()) {
  const rel = relative(adminDir, file);
  for (const { exportName, source } of templatesOf(readFileSync(file, 'utf8'))) {
    let document: DocumentNode;
    try {
      document = parse(source);
    } catch (error) {
      add(rel, `${exportName}: PARSE ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (!document.definitions.some(isOperation)) continue;
    checked += 1;
    for (const error of validate(schema, document)) add(rel, `${exportName}: ${error.message}`);
  }
}

for (const [file, errors] of byFile) {
  console.error(`\n${file}`);
  for (const error of errors) console.error(`  - ${error}`);
}
console.log(`\nAdmin contract verification: ${checked} operations checked, ${failed} errors.`);
if (failed) process.exit(1);
