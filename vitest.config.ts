import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: false,
    coverage: {
      reporter: ['text', 'json', 'html'],
      provider: 'v8',
    },
  },
});
