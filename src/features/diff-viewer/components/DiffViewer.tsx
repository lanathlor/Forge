'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import {
  Columns2,
  Rows3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileX2,
  PanelLeftClose,
  PanelLeftOpen,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Keyboard,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useMediaQuery } from '@/shared/hooks';
import type { DiffResult, FileChange } from '@/lib/git/diff';
import { FileTree } from './FileTree';
import { DiffStats } from './DiffStats';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiffViewerProps {
  taskId: string;
}

type ViewMode = 'side-by-side' | 'unified';

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  php: 'php',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  vue: 'html',
  svelte: 'html',
};

function getLanguageFromPath(path: string): string {
  const filename = path.split('/').pop() || '';
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'plaintext';
}

// ---------------------------------------------------------------------------
// File status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  FileChange['status'],
  { label: string; cls: string }
> = {
  added: { label: 'Added', cls: 'bg-emerald-500/15 text-emerald-500' },
  modified: { label: 'Modified', cls: 'bg-blue-500/15 text-blue-400' },
  deleted: { label: 'Deleted', cls: 'bg-red-500/15 text-red-400' },
  renamed: { label: 'Renamed', cls: 'bg-amber-500/15 text-amber-400' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DiffToolbar({
  isMobile,
  sidebarOpen,
  onToggleSidebar,
  minimapEnabled,
  onToggleMinimap,
  isFullscreen,
  onToggleFullscreen,
  viewMode,
  onSetViewMode,
  stats,
}: {
  isMobile: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  minimapEnabled: boolean;
  onToggleMinimap: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  stats: DiffResult['stats'];
}) {
  const effectiveViewMode = isMobile ? 'unified' : viewMode;

  return (
    <div className="flex flex-shrink-0 items-center border-b border-border bg-surface-raised">
      {/* Left: sidebar toggle + stats */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {!isMobile && (
          <button
            onClick={onToggleSidebar}
            className="ml-1 rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-interactive hover:text-text-primary"
            title={sidebarOpen ? 'Hide file tree' : 'Show file tree'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <DiffStats stats={stats} />
      </div>

      {/* Right: view controls */}
      <div className="flex flex-shrink-0 items-center gap-0.5 px-2">
        {/* Minimap toggle */}
        <button
          onClick={onToggleMinimap}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            minimapEnabled
              ? 'bg-accent-primary/15 text-accent-primary'
              : 'text-text-muted hover:bg-surface-interactive hover:text-text-primary'
          )}
          title={minimapEnabled ? 'Hide minimap' : 'Show minimap'}
        >
          <MapIcon className="h-3.5 w-3.5" />
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={onToggleFullscreen}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            isFullscreen
              ? 'bg-accent-primary/15 text-accent-primary'
              : 'text-text-muted hover:bg-surface-interactive hover:text-text-primary'
          )}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Side-by-side / Unified toggle (desktop only) */}
        {!isMobile && (
          <div className="ml-1 flex items-center overflow-hidden rounded-md border border-border">
            <button
              onClick={() => onSetViewMode('side-by-side')}
              className={cn(
                'flex min-h-[28px] items-center gap-1 px-2 py-1 text-xs transition-colors',
                effectiveViewMode === 'side-by-side'
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-text-muted hover:bg-surface-interactive hover:text-text-primary'
              )}
              title="Side by side"
            >
              <Columns2 className="h-3 w-3" />
              <span className="hidden lg:inline">Split</span>
            </button>
            <button
              onClick={() => onSetViewMode('unified')}
              className={cn(
                'flex min-h-[28px] items-center gap-1 px-2 py-1 text-xs transition-colors',
                effectiveViewMode === 'unified'
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-text-muted hover:bg-surface-interactive hover:text-text-primary'
              )}
              title="Unified"
            >
              <Rows3 className="h-3 w-3" />
              <span className="hidden lg:inline">Unified</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FileHeader({
  selectedFile,
  currentIndex,
  totalFiles,
  onPrev,
  onNext,
}: {
  selectedFile: FileChange;
  currentIndex: number;
  totalFiles: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const badge = STATUS_BADGE[selectedFile.status];

  // Split path for breadcrumb display
  const parts = selectedFile.path.split('/');
  const fileName = parts.pop() || selectedFile.path;
  const dirPath = parts.join('/');

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3 py-1.5">
      {/* Prev/next file navigation */}
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <button
          onClick={onPrev}
          disabled={currentIndex <= 0}
          className={cn(
            'min-h-[24px] rounded p-1 transition-colors',
            currentIndex <= 0
              ? 'cursor-not-allowed text-text-disabled'
              : 'text-text-muted hover:bg-surface-interactive hover:text-text-primary'
          )}
          title="Previous file"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[36px] text-center text-[10px] tabular-nums text-text-muted">
          {currentIndex + 1}/{totalFiles}
        </span>
        <button
          onClick={onNext}
          disabled={currentIndex >= totalFiles - 1}
          className={cn(
            'min-h-[24px] rounded p-1 transition-colors',
            currentIndex >= totalFiles - 1
              ? 'cursor-not-allowed text-text-disabled'
              : 'text-text-muted hover:bg-surface-interactive hover:text-text-primary'
          )}
          title="Next file"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* File path with breadcrumb style */}
      <h3
        className="flex flex-1 items-center gap-0.5 truncate font-mono text-xs"
        title={selectedFile.path}
      >
        {dirPath && <span className="text-text-muted">{dirPath}/</span>}
        <span className="font-medium text-text-primary">{fileName}</span>
      </h3>

      {/* Status badge */}
      {badge && (
        <span
          className={cn(
            'flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
            badge.cls
          )}
        >
          {badge.label}
        </span>
      )}

      {/* File stats inline */}
      {(selectedFile.additions > 0 || selectedFile.deletions > 0) && (
        <div className="hidden flex-shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums sm:flex">
          {selectedFile.additions > 0 && (
            <span className="text-emerald-500">+{selectedFile.additions}</span>
          )}
          {selectedFile.deletions > 0 && (
            <span className="text-red-400">-{selectedFile.deletions}</span>
          )}
        </div>
      )}

      {/* Line-level comment anchor placeholder for future use */}
      <div data-comment-anchor={selectedFile.path} className="hidden" />
    </div>
  );
}

function EditorContent({
  selectedFile,
  fileContent,
  effectiveViewMode,
  isMobile,
  minimapEnabled,
  onMount,
}: {
  selectedFile: FileChange | null;
  fileContent: { before: string; after: string } | null;
  effectiveViewMode: ViewMode;
  isMobile: boolean;
  minimapEnabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMount: (editor: any) => void;
}) {
  if (selectedFile && fileContent) {
    return (
      <DiffEditor
        height="100%"
        language={getLanguageFromPath(selectedFile.path)}
        original={fileContent.before}
        modified={fileContent.after}
        onMount={onMount}
        options={{
          readOnly: true,
          renderSideBySide: effectiveViewMode === 'side-by-side',
          minimap: { enabled: minimapEnabled },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineHeight: 20,
          hideUnchangedRegions: {
            enabled: true,
            revealLineCount: 3,
            minimumLineCount: 5,
            contextLineCount: 3,
          },
          renderOverviewRuler: minimapEnabled,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          glyphMargin: false,
          folding: true,
          wordWrap: effectiveViewMode === 'unified' && isMobile ? 'on' : 'off',
          padding: { top: 8, bottom: 8 },
          enableSplitViewResizing: true,
          useInlineViewWhenSpaceIsLimited: true,
          renderIndicators: true,
          renderMarginRevertIcon: false,
        }}
        theme="vs-dark"
      />
    );
  }

  if (selectedFile && !fileContent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading file...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-xs text-text-muted">
        Select a file to view changes
      </span>
    </div>
  );
}

function MobileFileSelector({
  files,
  selectedFile,
  onSelectFile,
}: {
  files: FileChange[];
  selectedFile: FileChange | null;
  onSelectFile: (file: FileChange) => void;
}) {
  return (
    <div className="scrollbar-hide flex-shrink-0 overflow-x-auto border-t border-border bg-surface-raised px-2 py-1.5">
      <div className="flex gap-1">
        {files.map((file) => {
          const b = STATUS_BADGE[file.status];
          const isSelected = selectedFile?.path === file.path;
          const fileName = file.path.split('/').pop() || file.path;
          return (
            <button
              key={file.path}
              onClick={() => onSelectFile(file)}
              className={cn(
                'flex min-h-[28px] flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 font-mono text-[11px] transition-colors',
                isSelected
                  ? 'bg-accent-primary/15 text-accent-primary'
                  : 'text-text-secondary hover:bg-surface-interactive'
              )}
              title={file.path}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                  b.cls.split(' ')[0]
                )}
              />
              {fileName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard shortcut hint
// ---------------------------------------------------------------------------

function KeyboardHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-[10px] text-text-muted',
        className
      )}
    >
      <Keyboard className="h-3 w-3" />
      <span className="flex items-center gap-1">
        <kbd className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono">
          j
        </kbd>
        <kbd className="rounded border border-border bg-surface-sunken px-1 py-0.5 font-mono">
          k
        </kbd>
        <span>navigate</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiffViewer({ taskId }: DiffViewerProps) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [fileContent, setFileContent] = useState<{
    before: string;
    after: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [minimapEnabled, setMinimapEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Force unified on mobile
  const effectiveViewMode = isMobile ? 'unified' : viewMode;
  // Force sidebar closed on mobile
  const effectiveSidebarOpen = isMobile ? false : sidebarOpen;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadDiff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}/diff`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load diff');
      }
      const data: DiffResult = await res.json();
      setDiff(data);

      if (data.changedFiles?.length > 0) {
        setSelectedFile(data.changedFiles[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const loadFileContent = useCallback(
    async (path: string) => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/files/${path}`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to load file content');
        }
        const data = await res.json();
        setFileContent(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load file content'
        );
      }
    },
    [taskId]
  );

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  useEffect(() => {
    if (selectedFile) {
      setFileContent(null);
      loadFileContent(selectedFile.path);
    }
  }, [selectedFile, loadFileContent]);

  // ---------------------------------------------------------------------------
  // File navigation
  // ---------------------------------------------------------------------------

  const currentIndex =
    diff?.changedFiles.findIndex((f) => f.path === selectedFile?.path) ?? -1;

  const goToPrev = useCallback(() => {
    if (!diff || currentIndex <= 0) return;
    const prev = diff.changedFiles[currentIndex - 1];
    if (prev) setSelectedFile(prev);
  }, [diff, currentIndex]);

  const goToNext = useCallback(() => {
    if (!diff || currentIndex >= diff.changedFiles.length - 1) return;
    const next = diff.changedFiles[currentIndex + 1];
    if (next) setSelectedFile(next);
  }, [diff, currentIndex]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case 'j':
          e.preventDefault();
          goToNext();
          break;
        case 'k':
          e.preventDefault();
          goToPrev();
          break;
        case 'b':
          if (!isMobile) {
            e.preventDefault();
            setSidebarOpen((v) => !v);
          }
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            setIsFullscreen(false);
          }
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, isMobile, isFullscreen]);

  // ---------------------------------------------------------------------------
  // Editor mount handler
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // ---------------------------------------------------------------------------
  // Loading / Error / Empty states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">Loading diff...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span className="text-xs">Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!diff || diff.changedFiles.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-text-muted">
          <FileX2 className="h-5 w-5" />
          <span className="text-xs">No changes detected</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full flex-col overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 bg-surface-base'
      )}
    >
      {/* ── Toolbar ── */}
      <DiffToolbar
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        minimapEnabled={minimapEnabled}
        onToggleMinimap={() => setMinimapEnabled(!minimapEnabled)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        stats={diff.stats}
      />

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar (desktop only) ── */}
        {effectiveSidebarOpen && (
          <aside className="flex w-60 flex-shrink-0 flex-col overflow-hidden border-r border-border bg-surface-raised xl:w-72">
            <FileTree
              files={diff.changedFiles}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
              className="min-h-0 flex-1"
            />
            <KeyboardHint className="border-t border-border px-3 py-1.5" />
          </aside>
        )}

        {/* ── Editor pane ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* File header */}
          {selectedFile && (
            <FileHeader
              selectedFile={selectedFile}
              currentIndex={currentIndex}
              totalFiles={diff.changedFiles.length}
              onPrev={goToPrev}
              onNext={goToNext}
            />
          )}

          {/* Monaco diff editor */}
          <div className="relative flex-1">
            <EditorContent
              selectedFile={selectedFile}
              fileContent={fileContent}
              effectiveViewMode={effectiveViewMode}
              isMobile={isMobile}
              minimapEnabled={minimapEnabled}
              onMount={handleEditorMount}
            />
          </div>
        </main>
      </div>

      {/* ── Mobile file selector ── */}
      {isMobile && (
        <MobileFileSelector
          files={diff.changedFiles}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      )}
    </div>
  );
}
