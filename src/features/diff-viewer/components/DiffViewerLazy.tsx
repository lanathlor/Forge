'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

// Lazy load the DiffViewer component which includes Monaco editor
const DiffViewer = React.lazy(() =>
  import('./DiffViewer').then((mod) => ({ default: mod.DiffViewer }))
);

interface DiffViewerLazyProps {
  taskId: string;
}

function DiffViewerFallback() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading diff viewer...</span>
      </div>
    </div>
  );
}

/**
 * Lazy-loaded DiffViewer component with code splitting
 *
 * This wrapper enables code splitting for the Monaco editor bundle,
 * which is one of the heaviest dependencies (~2MB).
 * The editor is only loaded when the diff viewer is actually displayed.
 */
export function DiffViewerLazy({ taskId }: DiffViewerLazyProps) {
  return (
    <React.Suspense fallback={<DiffViewerFallback />}>
      <DiffViewer taskId={taskId} />
    </React.Suspense>
  );
}

export default DiffViewerLazy;
