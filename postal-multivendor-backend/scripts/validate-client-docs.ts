/**
 * validate-client-docs.ts
 *
 * Extracts every GraphQL document embedded in a client source folder and
 * validates it against the backend schema. This is the guard-rail that proves
 * the Store and Rider apps can talk to this backend without a single
 * "Response not successful: Received status code 400" (GraphQL validation)
 * error.
 *
 * Client code stores documents in two idioms:
 *   gql`query Foo { ... }`
 *   const DOC = `#graphql
 *     query Foo { ... }`
 * Fragments are frequently shared between files and inlined with template
 * interpolation (`${restaurantPreviewFragment}`). The extractor resolves those
 * references so each document is validated as the client actually sends it.
 *
 * Documents exported but never imported anywhere are dead code and are skipped
 * (they cannot cause a runtime 400 because they are never sent).
 *
 * Usage:
 *   tsx scripts/validate-client-docs.ts ../store-app/lib
 *   tsx scripts/validate-client-docs.ts ../rider-app/lib
 *
 * Exit code is non-zero when any document fails to parse or validate.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { buildSchema, parse, validate, DocumentNode, GraphQLError, DefinitionNode } from 'graphql';
import { typeDefs } from '../src/graphql/typeDefs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.expo', 'ios', 'android']);

interface SourceFile {
  path: string;
  text: string;
}

interface ExtractedDocument {
  file: string;
  line: number;
  source: string;
  exportName?: string;
}

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) out.push(full);
  }
  return out;
};

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** Remove the `#graphql` marker without leaving the rest of the line commented out. */
const stripMarker = (body: string): string => body.replace(/#graphql[^\S\n]*/g, '');

/**
 * Build a lookup of every template literal assigned to a const, so that
 * `${fragmentName}` interpolations can be resolved.
 */
const buildConstMap = (files: SourceFile[]): Map<string, string> => {
  const map = new Map<string, string>();
  const re = /\b(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*`([\s\S]*?)`/g;
  for (const file of files) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(file.text))) map.set(m[1], m[2]);
  }
  return map;
};

const resolveInterpolations = (body: string, constMap: Map<string, string>, depth = 0): string => {
  if (depth > 10) return body;
  return body.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, name: string) => {
    const ref = constMap.get(name);
    return ref === undefined ? whole : resolveInterpolations(stripMarker(ref), constMap, depth + 1);
  });
};

/** Find the name of the exported const whose template starts at `index`. */
const exportedNameBefore = (text: string, index: number): string | undefined => {
  const prefix = text.slice(0, index);
  const m = [...prefix.matchAll(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*$/g)].pop();
  return m?.[1];
};

const extractDocuments = (file: SourceFile): ExtractedDocument[] => {
  const { path, text } = file;
  const docs: ExtractedDocument[] = [];

  const tagged = /\b(?:gql|graphql)\s*`([\s\S]*?)`/g;
  let match: RegExpExecArray | null;
  while ((match = tagged.exec(text))) {
    const body = match[1];
    if (/\b(query|mutation|subscription|fragment)\b/.test(body)) {
      docs.push({ file: path, line: lineOf(text, match.index), source: body, exportName: exportedNameBefore(text, match.index) });
    }
  }

  const raw = /`(\s*#graphql[\s\S]*?)`/g;
  while ((match = raw.exec(text))) {
    const body = match[1];
    if (/\b(query|mutation|subscription|fragment)\b/.test(body)) {
      docs.push({ file: path, line: lineOf(text, match.index), source: body, exportName: exportedNameBefore(text, match.index) });
    }
  }

  return docs;
};

const main = (): void => {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: tsx scripts/validate-client-docs.ts <client-source-folder>');
    process.exit(2);
  }

  const root = resolve(process.cwd(), target);
  const schema = buildSchema(typeDefs);
  const files: SourceFile[] = walk(root).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const constMap = buildConstMap(files);
  const documents = files.flatMap(extractDocuments);

  // A document exported but never referenced outside its own file is dead code.
  const isReferencedElsewhere = (doc: ExtractedDocument): boolean => {
    if (!doc.exportName) return true;
    const needle = new RegExp(`\\b${doc.exportName}\\b`);
    return files.some((f) => f.path !== doc.file && needle.test(f.text));
  };

  let errorCount = 0;
  let documentCount = 0;
  let skipped = 0;

  for (const doc of documents) {
    if (!isReferencedElsewhere(doc)) {
      skipped += 1;
      continue;
    }

    const source = resolveInterpolations(stripMarker(doc.source), constMap);
    documentCount += 1;

    let parsed: DocumentNode;
    try {
      parsed = parse(source, { noLocation: false });
    } catch (err) {
      errorCount += 1;
      const gqlErr = err as GraphQLError;
      console.error(`\n✗ ${relative(process.cwd(), doc.file)}:${doc.line} — parse error`);
      console.error(`  ${gqlErr.message}`);
      continue;
    }

    // Standalone fragment exports are inlined into the documents that use them.
    const definitions = parsed.definitions.filter((d: DefinitionNode) => d.kind !== 'FragmentDefinition');
    if (definitions.length === 0) {
      skipped += 1;
      continue;
    }

    const errors = validate(schema, parsed);
    if (errors.length) {
      errorCount += errors.length;
      console.error(`\n✗ ${relative(process.cwd(), doc.file)}:${doc.line}`);
      for (const e of errors) {
        const loc = e.locations?.[0];
        const where = loc ? ` (line ${loc.line})` : '';
        console.error(`  - ${e.message}${where}`);
      }
    }
  }

  const label = relative(process.cwd(), root) || root;
  if (errorCount === 0) {
    console.log(`✓ ${label}: ${documentCount} document(s) validated, 0 errors (${skipped} unused skipped)`);
    process.exit(0);
  }

  console.error(`\n✗ ${label}: ${errorCount} validation error(s) across ${documentCount} document(s)`);
  process.exit(1);
};

main();
