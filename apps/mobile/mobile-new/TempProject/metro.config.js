/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 */

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

module.exports = (async () => {
  const defaultConfig = await getDefaultConfig(); // DO NOT pass __dirname on Windows
  return mergeConfig(defaultConfig, {
    transformer: {
      babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
    },
    resolver: {
      sourceExts: ['js', 'jsx', 'ts', 'tsx'],
    },
    watchFolders: [path.resolve(__dirname, 'node_modules')],
  });
})();

