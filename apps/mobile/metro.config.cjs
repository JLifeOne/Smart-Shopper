const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const resolveVirtualStoreDir = () => {
  const npmrcPath = path.resolve(workspaceRoot, '.npmrc');
  if (!fs.existsSync(npmrcPath)) {
    return path.resolve(workspaceRoot, 'node_modules/.pnpm');
  }
  const content = fs.readFileSync(npmrcPath, 'utf8');
  const match = content.match(/virtual-store-dir\s*=\s*(.+)/);
  if (!match) {
    return path.resolve(workspaceRoot, 'node_modules/.pnpm');
  }
  return path.resolve(workspaceRoot, match[1].trim());
};

const virtualStoreDir = resolveVirtualStoreDir();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toPosixPath = (value) => value.replace(/\\/g, '/');

const listWorkspacePackageRoots = () => {
  const packagesRoot = path.resolve(workspaceRoot, 'packages');
  const roots = [];
  if (!fs.existsSync(packagesRoot)) {
    return roots;
  }
  fs.readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .forEach((entry) => {
      const packageRoot = path.resolve(packagesRoot, entry.name);
      if (fs.existsSync(path.resolve(packageRoot, 'package.json'))) {
        roots.push(packageRoot);
      }
    });
  return roots;
};

const config = getDefaultConfig(projectRoot);

const workspacePackageRoots = listWorkspacePackageRoots();

// Watch workspace package roots and the pnpm virtual store; blocklist package node_modules on Windows.
config.watchFolders = Array.from(new Set([...workspacePackageRoots, virtualStoreDir]));

config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...config.resolver.nodeModulesPaths,
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
    virtualStoreDir
  ])
);

const blockListSources = workspacePackageRoots.map((packageRoot) =>
  `${escapeRegExp(toPosixPath(packageRoot))}/node_modules(?:/|$).*`
);
if (blockListSources.length > 0) {
  // Use case-insensitive matching to avoid drive-letter casing mismatches on Windows.
  config.resolver.blockList = new RegExp(blockListSources.join('|'), 'i');
}

module.exports = config;
