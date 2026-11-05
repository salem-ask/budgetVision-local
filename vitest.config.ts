// Configuration des tests (séparée de vite.config.ts : la production n'a pas besoin de vitest).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
