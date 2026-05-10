import { defineConfig } from 'vitest/config';

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
  },
});
