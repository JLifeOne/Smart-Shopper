const nextJestIgnore = [
  'react-native',
  '@react-native',
  'expo',
  '@expo',
  'expo-router',
  'react-native-reanimated',
  'react-native-gesture-handler'
];

module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.(ts|tsx)', '**/?(*.)+(spec|test).(ts|tsx)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [`node_modules/(?!(${nextJestIgnore.join('|')})/)`],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '!**/__tests__/**'
  ]
};
