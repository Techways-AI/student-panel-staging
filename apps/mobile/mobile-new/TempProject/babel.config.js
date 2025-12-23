module.exports = {
  presets: [
    'module:metro-react-native-babel-preset',
    '@babel/preset-env',
    '@babel/preset-react',
    '@babel/preset-typescript', // 👈 allows `as Type` syntax
  ],
  plugins: [
    ['@babel/plugin-syntax-flow'], // 👈 handles Flow syntax in RN files
  ],
};

