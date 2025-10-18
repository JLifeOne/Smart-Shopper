const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...config.watchFolders, workspaceRoot]));

config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...config.resolver.nodeModulesPaths,
    path.resolve(workspaceRoot, 'node_modules')
  ])
);

module.exports = config;
