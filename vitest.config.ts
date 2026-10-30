import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@scopa': fileURLToPath(new URL('./supabase/functions/_shared/scopa/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['supabase/functions/**/*.test.ts', 'src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
