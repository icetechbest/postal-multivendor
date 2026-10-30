import { readFileSync } from 'fs';
import { resolve } from 'path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { DocumentNode, OperationDefinitionNode, parse, validate } from 'graphql';
import { resolvers } from '../src/graphql/resolvers';
import { typeDefs } from '../src/graphql/typeDefs';

const appDir = resolve(process.cwd(), process.env.APP_DIR || '../postal-multivendor-app');
const files = ['queries.js', 'mutations.js', 'subscriptions.js'];
const schema = makeExecutableSchema({ typeDefs, resolvers });

const exportedTemplates = (source: string): Map<string, string> => {
  const templates = new Map<string, string>();
  const pattern = /export\s+const\s+(\w+)\s*=\s*(?:gql\s*)?`([\s\S]*?)`/g;
  for (const match of source.matchAll(pattern)) templates.set(match[1], match[2]);
  return templates;
};

const resolveFragments = (name: string, templates: Map<string, string>, seen = new Set<string>()): string => {
  if (seen.has(name)) throw new Error(`Circular template reference: ${name}`);
  const nextSeen = new Set(seen).add(name);
  const source = templates.get(name) || '';
  return source.replace(/\$\{(\w+)\}/g, (_match, reference) => resolveFragments(reference, templates, nextSeen));
};

const operations = (document: DocumentNode): OperationDefinitionNode[] =>
  document.definitions.filter((definition): definition is OperationDefinitionNode => definition.kind === 'OperationDefinition');

let checked = 0;
let failed = 0;
for (const file of files) {
  const source = readFileSync(resolve(appDir, 'src/apollo', file), 'utf8');
  const templates = exportedTemplates(source);
  for (const [name] of templates) {
    let document: DocumentNode;
    try {
      document = parse(resolveFragments(name, templates));
    } catch (error) {
      failed += 1;
      console.error(`${file}:${name}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (!operations(document).length) continue;
    checked += 1;
    const errors = validate(schema, document);
    if (errors.length) {
      failed += errors.length;
      for (const error of errors) console.error(`${file}:${name}: ${error.message}`);
    }
  }
}

console.log(`Contract verification: ${checked} operations checked, ${failed} errors.`);
if (failed) process.exit(1);
