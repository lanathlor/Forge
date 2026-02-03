import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/app/**', // Next.js app router (tested via E2E)
        'src/db/migrations/**', // Generated migrations
        'src/db/seed.ts', // Seed script
        'src/db/schema/**', // DB schema type definitions
        'src/db/init.ts', // DB init script
        'src/db/index.ts', // DB connection (tested via integration)
        'src/lib/qa-gates/runner.ts', // Complex integration testing needed
        'src/features/repositories/api/**', // API handlers (tested via E2E)
        'src/features/repositories/store/**', // Redux store (tested via integration)
        'src/features/sessions/store/**', // Redux store (tested via integration)
        'src/shared/store/**', // Redux store (tested via integration)
        'src/store/**', // Redux store setup (tested via integration)
        'src/types/index.ts', // Type definitions (tested indirectly)
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
