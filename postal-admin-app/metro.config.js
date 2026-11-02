const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedDocs = path.resolve(workspaceRoot, 'packages/graphql-docs');

const config = getDefaultConfig(projectRoot);

// The app vendors the shared GraphQL documents in `lib/graphql-docs` so a
// standalone checkout (EAS Build, CI, a plain `git clone`) builds without the
// monorepo sibling. When the shared package is present (local monorepo dev) we
// also watch it, so edits there are picked up by the dev server.
if (fs.existsSync(sharedDocs)) {
  config.watchFolders = [sharedDocs];
}

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
if (fs.existsSync(path.resolve(workspaceRoot, 'node_modules'))) {
  config.resolver.nodeModulesPaths.push(path.resolve(workspaceRoot, 'node_modules'));
}
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
