const path = require('path');
const {getDefaultConfig} = require('@react-native/metro-config');
const analytics = require('../packages/core/package.json');
const firebase = require('../packages/analytics-firebase/package.json');
const mixpanel = require('../packages/analytics-mixpanel/package.json');

const root = path.resolve(__dirname, '..');
const modules = Object.keys({
  ...(analytics.peerDependencies || {}),
  ...(firebase.peerDependencies || {}),
  ...(mixpanel.peerDependencies || {}),
});

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  projectRoot: __dirname,
  watchFolders: [root],
  resolver: {
    ...config.resolver,
    // Resolve hoisted workspace deps from the monorepo root.
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(root, 'node_modules', name);
      return acc;
    }, {}),
  },
  transformer: {
    ...config.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};
