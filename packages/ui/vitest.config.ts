import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@smart-shopper/theming': path.resolve(__dirname, '../theme/src'),
      'react-native': path.resolve(__dirname, 'test/mocks/react-native.ts')
    }
  },
  test: {
    environment: 'node',
    globals: true
  }
});
