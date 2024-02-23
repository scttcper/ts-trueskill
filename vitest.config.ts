import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    isolate: false,
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'json', 'html'],
      provider: 'v8',
    },
  },
});
