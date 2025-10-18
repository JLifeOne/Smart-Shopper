module.exports = {
  root: true,
  extends: ['@react-native-community'],
  ignorePatterns: ['expo-env.d.ts', 'babel.config.js', 'metro.config.js', 'jest.config.js', 'index.js'],
  parserOptions: {
    requireConfigFile: false
  },
  env: {
    'jest/globals': true
  },
  plugins: ['jest'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react-native/no-inline-styles': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'prettier/prettier': 'off',
    'comma-dangle': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  }
};
