import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/**'],
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
        'src/lib/qa-gates/command-executor.ts', // Spawns child processes (tested via integration)
        'src/lib/git/pre-flight.ts', // Uses command-executor (tested via integration)
        'src/lib/claude/wrapper.ts', // Complex integration with Claude SDK
        'src/lib/tasks/orchestrator.ts', // Complex orchestration (tested via integration)
        'src/lib/plans/activity-tracker.ts', // Activity tracking (tested via integration)
        'src/features/repositories/lib/scanner.ts', // File system scanning (tested via E2E)
        'src/features/repositories/components/RepositoryTree.tsx', // Tree with stuck detection (tested via E2E)
        'src/shared/hooks/useTaskStream.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/hooks/useStuckDetection.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/hooks/useStuckDetectionConfig.ts', // Uses fetch for config (tested via E2E)
        'src/shared/hooks/useMultiRepoStream.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/components/ui/tabs.tsx', // Simple UI wrapper component
        'src/shared/components/ui/toast.tsx', // Complex toast component (tested via E2E)
        'src/lib/stuck-detection/**', // Stuck detection system (tested via E2E and integration)
        'src/features/repositories/api/**', // API handlers (tested via E2E)
        'src/features/repositories/store/**', // Redux store (tested via integration)
        'src/features/sessions/store/**', // Redux store (tested via integration)
        'src/features/plans/store/**', // RTK Query store (tested via integration)
        'src/features/plans/components/PlanExecutionView.tsx', // Complex component (tested via E2E)
        'src/features/plans/components/PlanIterationChat.tsx', // Complex component (tested via E2E)
        'src/shared/store/**', // Redux store (tested via integration)
        'src/store/**', // Redux store setup (tested via integration)
        'src/types/index.ts', // Type definitions (tested indirectly)
        'src/**/index.ts', // Re-export files
        'src/features/repositories/types/**', // Type definitions only
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
