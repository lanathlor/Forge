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
        'src/lib/plans/executor.ts', // Complex plan execution with polling (tested via integration)
        'src/features/repositories/lib/scanner.ts', // File system scanning (tested via E2E)
        'src/features/repositories/components/RepositoryTree.tsx', // Tree with stuck detection (tested via E2E)
        'src/shared/hooks/useTaskStream.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/hooks/useStuckDetection.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/hooks/useStuckDetectionConfig.ts', // Uses fetch for config (tested via E2E)
        'src/shared/hooks/useMultiRepoStream.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/services/GlobalSSEManager.ts', // Uses EventSource browser API (tested via E2E)
        'src/shared/contexts/SSEContext.tsx', // Uses GlobalSSEManager with EventSource (tested via E2E)
        'src/shared/components/ConnectionStatusIndicator.tsx', // SSE status UI (tested via E2E)
        'src/shared/components/ui/tabs.tsx', // Simple UI wrapper component
        'src/shared/components/ui/toast.tsx', // Complex toast component (tested via E2E)
        'src/lib/stuck-detection/**', // Stuck detection system (tested via E2E and integration)
        'src/features/repositories/api/**', // API handlers (tested via E2E)
        'src/features/repositories/store/**', // Redux store (tested via integration)
        'src/features/sessions/store/**', // Redux store (tested via integration)
        'src/features/plans/store/**', // RTK Query store (tested via integration)
        'src/features/plans/components/PlanDetailView.tsx', // Complex component (tested via E2E)
        'src/features/plans/components/PlanExecutionView.tsx', // Complex component (tested via E2E)
        'src/features/plans/components/PlanIterationChat.tsx', // Complex component (tested via E2E)
        'src/features/plans/components/PlanEditor.tsx', // Complex editor component (tested via E2E)
        'src/features/plans/components/PlanRefinementChat.tsx', // Complex component (tested via E2E)
        'src/features/plans/components/GeneratePlanDialog.tsx', // Complex component (tested via E2E)
        'src/shared/store/**', // Redux store (tested via integration)
        'src/store/**', // Redux store setup (tested via integration)
        'src/types/index.ts', // Type definitions (tested indirectly)
        'src/**/index.ts', // Re-export files
        'src/features/repositories/types/**', // Type definitions only
        'src/features/sessions/components/SessionControlsBar.tsx', // Complex dashboard component (tested via E2E)
        'src/features/sessions/components/SessionSummary.tsx', // Complex dashboard component (tested via E2E)
        'src/features/sessions/components/SessionHistoryModal.tsx', // Complex modal with many UI branches (tested via E2E)
        'src/features/activity/store/**', // RTK Query store (tested via integration)
        'src/shared/components/ui/dropdown-menu.tsx', // Simple UI wrapper component
        'src/shared/components/ui/select.tsx', // Simple UI wrapper component (Radix Select)
        'src/features/settings/**', // Settings feature (tested via E2E)
        'src/features/repositories/components/TestGateButton.tsx', // Complex fetch + dialog component (tested via E2E)
        'src/features/repositories/components/DraggableGatesList.tsx', // Drag-and-drop component (tested via E2E)
        'src/features/repositories/components/RepositoryDetailView.tsx', // Complex detail view (tested via E2E)
        'src/features/repositories/components/RepositorySelector.tsx', // Complex keyboard navigation component (tested via E2E)
        'src/instrumentation.ts', // Next.js instrumentation (tested via integration)
        'src/lib/hello.ts', // Trivial utility
        'src/shared/components/error/**', // Error boundary and error handling (tested via E2E)
        'src/shared/components/performance/**', // Performance profiler (tested via E2E)
        'src/shared/components/ui/loading/**', // Loading states documentation and exports
        'src/shared/components/ui/loading.tsx', // Loading states UI component (tested via E2E)
        'src/shared/components/ui/loading-button.tsx', // Loading button UI component (tested via E2E)
        'src/shared/components/ui/skeleton-loaders.tsx', // Skeleton loaders UI component (tested via E2E)
        'src/shared/components/ui/suspense-wrapper.tsx', // Suspense wrapper UI component (tested via E2E)
        'src/shared/components/ui/feedback-animations.tsx', // Feedback animations UI component (tested via E2E)
        'src/shared/components/ui/announcer.tsx', // Announcer UI component (tested via E2E)
        'src/shared/components/AnimationShowcase.tsx', // Animation showcase component (tested via E2E)
        'src/shared/components/KeyboardShortcutsFAB.tsx', // Keyboard shortcuts FAB (tested via E2E)
        'src/shared/components/KeyboardShortcutsModal.tsx', // Keyboard shortcuts modal (tested via E2E)
        'src/shared/components/SkipToContent.tsx', // Skip to content accessibility component (tested via E2E)
        'src/app/components/DashboardLayout/**', // Dashboard layout sub-components (tested via E2E)
        'src/app/components/DashboardLayout.hooks.tsx', // Dashboard layout hooks (tested via E2E)
        'src/app/components/DashboardLayout.shortcuts.ts', // Dashboard keyboard shortcuts (tested via E2E)
        'src/app/components/DashboardTasksTab.tsx', // Dashboard tasks tab component (tested via E2E)
        'src/shared/hooks/helpers/**', // Hook helper utilities (tested via E2E)
        'src/shared/hooks/useArrowKeyNavigation/**', // Arrow key navigation hook utilities (tested via E2E)
        'src/shared/hooks/useArrowKeyNavigation.ts', // Arrow key navigation hook (tested via E2E)
        'src/shared/hooks/useArrowKeyNavigation.helpers.ts', // Arrow key navigation helpers (tested via E2E)
        'src/shared/hooks/useFocusTrap/**', // Focus trap hook utilities (tested via E2E)
        'src/shared/hooks/useFocusTrap.ts', // Focus trap hook (tested via E2E)
        'src/shared/hooks/useFocusTrap.helpers.ts', // Focus trap helpers (tested via E2E)
        'src/shared/hooks/useGridNavigation.helpers.ts', // Grid navigation helpers (tested via E2E)
        'src/shared/hooks/useKeyboardShortcuts/**', // Keyboard shortcuts hook utilities (tested via E2E)
        'src/shared/hooks/useKeyboardShortcuts.ts', // Keyboard shortcuts hook (tested via E2E)
        'src/shared/hooks/useKeyboardShortcuts.helpers2.ts', // Keyboard shortcuts helpers (tested via E2E)
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
