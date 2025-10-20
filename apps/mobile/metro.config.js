const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

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

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...config.watchFolders, workspaceRoot, virtualStoreDir])
);

config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...config.resolver.nodeModulesPaths,
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
    virtualStoreDir
  ])
);

module.exports = config;
