'use client';

import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FilePlus,
  FileX,
  FilePen,
  ArrowRightLeft,
  FolderOpen,
  Folder,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { FileChange } from '@/lib/git/diff';

interface FileTreeProps {
  files: FileChange[];
  selectedFile: FileChange | null;
  onSelectFile: (file: FileChange) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Tree node type
// ---------------------------------------------------------------------------

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file?: FileChange;
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
}

// ---------------------------------------------------------------------------
// Build hierarchical tree from flat file list
// ---------------------------------------------------------------------------

function buildTree(files: FileChange[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    children: new Map(),
    totalAdditions: 0,
    totalDeletions: 0,
    totalFiles: 0,
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          children: new Map(),
          totalAdditions: 0,
          totalDeletions: 0,
          totalFiles: 0,
        });
      }

      const node = current.children.get(part)!;

      if (isFile) {
        node.file = file;
      }

      current = node;
    }

    // Roll up stats to all ancestors
    const ancestorParts = file.path.split('/');
    let ancestor = root;
    ancestor.totalAdditions += file.additions;
    ancestor.totalDeletions += file.deletions;
    ancestor.totalFiles += 1;

    for (let i = 0; i < ancestorParts.length; i++) {
      const child = ancestor.children.get(ancestorParts[i]!)!;
      if (i < ancestorParts.length - 1) {
        child.totalAdditions += file.additions;
        child.totalDeletions += file.deletions;
        child.totalFiles += 1;
      }
      ancestor = child;
    }
  }

  return root;
}

/**
 * Collapse single-child directories into "a/b/c" paths
 * for a cleaner display (like VS Code's compact folders).
 */
function flattenSingleChildDirs(node: TreeNode): TreeNode {
  const newChildren = new Map<string, TreeNode>();

  for (const [, child] of node.children) {
    let collapsed = child;

    // Collapse directories that have exactly one child which is also a directory
    while (!collapsed.file && collapsed.children.size === 1) {
      const entry = [...collapsed.children.entries()][0];
      if (!entry) break;
      const [, onlyChild] = entry;
      if (onlyChild.file) break; // Stop if the only child is a file
      collapsed = {
        ...onlyChild,
        name: `${collapsed.name}/${onlyChild.name}`,
      };
    }

    // Recursively flatten children
    const flattened = flattenSingleChildDirs(collapsed);
    newChildren.set(flattened.name, flattened);
  }

  return { ...node, children: newChildren };
}

// ---------------------------------------------------------------------------
// Status icon mapping
// ---------------------------------------------------------------------------

const STATUS_ICONS: Record<FileChange['status'], typeof File> = {
  added: FilePlus,
  modified: FilePen,
  deleted: FileX,
  renamed: ArrowRightLeft,
};

const STATUS_COLORS: Record<FileChange['status'], string> = {
  added: 'text-emerald-500',
  modified: 'text-blue-400',
  deleted: 'text-red-400',
  renamed: 'text-amber-400',
};

// ---------------------------------------------------------------------------
// Directory node component
// ---------------------------------------------------------------------------

function DirectoryNode({
  node,
  selectedFile,
  onSelectFile,
  depth,
  defaultOpen,
}: {
  node: TreeNode;
  selectedFile: FileChange | null;
  onSelectFile: (file: FileChange) => void;
  depth: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Sort children: directories first, then files, alphabetically within each group
  const sortedChildren = useMemo(() => {
    const entries = [...node.children.values()];
    return entries.sort((a, b) => {
      const aIsDir = !a.file;
      const bIsDir = !b.file;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs',
          'min-h-[28px] transition-colors hover:bg-surface-interactive',
          'text-text-secondary hover:text-text-primary'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-text-muted" />
        )}
        {open ? (
          <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
        ) : (
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/70" />
        )}
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-[10px] tabular-nums">
          {node.totalAdditions > 0 && (
            <span className="text-emerald-500">+{node.totalAdditions}</span>
          )}
          {node.totalDeletions > 0 && (
            <span className="text-red-400">-{node.totalDeletions}</span>
          )}
        </span>
      </button>
      {open && (
        <div>
          {sortedChildren.map((child) =>
            child.file ? (
              <FileNode
                key={child.path}
                file={child.file}
                name={child.name}
                selected={selectedFile?.path === child.file.path}
                onSelect={() => onSelectFile(child.file!)}
                depth={depth + 1}
              />
            ) : (
              <DirectoryNode
                key={child.path}
                node={child}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={depth + 1}
                defaultOpen={child.totalFiles <= 5}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File node component
// ---------------------------------------------------------------------------

function FileNode({
  file,
  name,
  selected,
  onSelect,
  depth,
}: {
  file: FileChange;
  name: string;
  selected: boolean;
  onSelect: () => void;
  depth: number;
}) {
  const Icon = STATUS_ICONS[file.status] || File;
  const iconColor = STATUS_COLORS[file.status] || 'text-text-muted';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex min-h-[28px] w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs',
        'transition-colors',
        selected
          ? 'bg-accent-primary/15 text-accent-primary'
          : 'text-text-secondary hover:bg-surface-interactive hover:text-text-primary'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      title={file.path}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          selected ? 'text-accent-primary' : iconColor
        )}
      />
      <span
        className={cn(
          'truncate font-mono text-[11px]',
          selected && 'font-medium'
        )}
      >
        {name}
      </span>
      <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-[10px] tabular-nums">
        {file.additions > 0 && (
          <span className="text-emerald-500">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-400">-{file.deletions}</span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Flat file node (for search results)
// ---------------------------------------------------------------------------

function FlatFileNode({
  file,
  selected,
  onSelect,
}: {
  file: FileChange;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = STATUS_ICONS[file.status] || File;
  const iconColor = STATUS_COLORS[file.status] || 'text-text-muted';
  const parts = file.path.split('/');
  const fileName = parts.pop() || file.path;
  const dirPath = parts.join('/');

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex min-h-[32px] w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
        'transition-colors',
        selected
          ? 'bg-accent-primary/15 text-accent-primary'
          : 'text-text-secondary hover:bg-surface-interactive hover:text-text-primary'
      )}
      title={file.path}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          selected ? 'text-accent-primary' : iconColor
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span
          className={cn(
            'w-full truncate text-left font-mono text-[11px]',
            selected && 'font-medium'
          )}
        >
          {fileName}
        </span>
        {dirPath && (
          <span className="w-full truncate text-left text-[10px] text-text-muted">
            {dirPath}
          </span>
        )}
      </div>
      <span className="flex flex-shrink-0 items-center gap-1.5 text-[10px] tabular-nums">
        {file.additions > 0 && (
          <span className="text-emerald-500">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-400">-{file.deletions}</span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main FileTree component
// ---------------------------------------------------------------------------

export function FileTree({
  files,
  selectedFile,
  onSelectFile,
  className,
}: FileTreeProps) {
  const [filter, setFilter] = useState('');

  const tree = useMemo(() => {
    const raw = buildTree(files);
    return flattenSingleChildDirs(raw);
  }, [files]);

  const sortedTopLevel = useMemo(() => {
    const entries = [...tree.children.values()];
    return entries.sort((a, b) => {
      const aIsDir = !a.file;
      const bIsDir = !b.file;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [tree.children]);

  // Filter files by search query
  const filteredFiles = useMemo(() => {
    if (!filter.trim()) return null;
    const q = filter.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(q));
  }, [files, filter]);

  const showFilter = files.length > 5;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Files
        </h3>
        <span className="text-[10px] tabular-nums text-text-muted">
          {files.length} changed
        </span>
      </div>

      {/* Search filter */}
      {showFilter && (
        <div className="border-b border-border px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter files..."
              className="w-full rounded-md border border-border bg-surface-sunken py-1 pl-7 pr-7 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/30"
            />
            {filter && (
              <button
                onClick={() => setFilter('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:bg-surface-interactive hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tree / filtered list */}
      <div className="scrollbar-hide flex-1 overflow-y-auto p-1.5">
        {filteredFiles ? (
          // Show flat filtered results
          filteredFiles.length > 0 ? (
            filteredFiles.map((file) => (
              <FlatFileNode
                key={file.path}
                file={file}
                selected={selectedFile?.path === file.path}
                onSelect={() => onSelectFile(file)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-4 text-xs text-text-muted">
              No files match &ldquo;{filter}&rdquo;
            </div>
          )
        ) : (
          // Show tree view
          sortedTopLevel.map((node) =>
            node.file ? (
              <FileNode
                key={node.path}
                file={node.file}
                name={node.name}
                selected={selectedFile?.path === node.file.path}
                onSelect={() => onSelectFile(node.file!)}
                depth={0}
              />
            ) : (
              <DirectoryNode
                key={node.path}
                node={node}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                depth={0}
                defaultOpen={node.totalFiles <= 8}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
