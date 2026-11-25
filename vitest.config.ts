import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/utils/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      // Old tags are run against today's tests (npm run metrics -- --ref); keep their coverage too.
      reportOnFailure: true,
      // Pure logic layer — UI components are covered by manual QA for now.
      include: ['src/utils/**/*.ts'],
      exclude: ['src/utils/__tests__/**'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
