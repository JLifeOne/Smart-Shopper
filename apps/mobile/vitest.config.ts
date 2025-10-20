import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: './.env' });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
    globals: true,
    setupFiles: []
  }
});
