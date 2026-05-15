import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Sequential execution prevents bitecs global state corruption across test files
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@config': resolve(__dirname, 'src/config'),
    },
  },
});
