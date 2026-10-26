import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.js'],   // ← matches src/tests/ layout
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
  },
});