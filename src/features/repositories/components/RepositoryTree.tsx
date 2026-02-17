'use client';

import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  GitBranch,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import { cn } from '@/shared/lib/utils';
import type { TreeNode } from '../lib/tree';
import type { Repository } from '@/db/schema';

interface RepositoryTreeProps {
  node: TreeNode;
  level?: number;
  selectedId?: string | null;
  onSelect: (repository: Repository) => void;
}

export function RepositoryTree({
  node,
  level = 0,
  selectedId,
  onSelect,
}: RepositoryTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set([node.path])
  );

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (node.type === 'folder' && level === 0) {
    return (
      <TreeNodeList
        nodes={node.children}
        level={0}
        selectedId={selectedId}
        onSelect={onSelect}
        expandedNodes={expandedNodes}
        onToggle={toggleNode}
      />
    );
  }

  return (
    <RepositoryTreeNode
      node={node}
      level={level}
      selectedId={selectedId}
      onSelect={onSelect}
      expandedNodes={expandedNodes}
      onToggle={toggleNode}
    />
  );
}

interface TreeNodeListProps {
  nodes: TreeNode[];
  level: number;
  selectedId?: string | null;
  onSelect: (repository: Repository) => void;
  expandedNodes: Set<string>;
  onToggle: (path: string) => void;
}

function TreeNodeList({
  nodes,
  level,
  selectedId,
  onSelect,
  expandedNodes,
  onToggle,
}: TreeNodeListProps) {
  return (
    <div>
      {nodes.map((child) => (
        <RepositoryTreeNode
          key={getNodeKey(child)}
          node={child}
          level={level}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedNodes={expandedNodes}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function getNodeKey(node: TreeNode): string {
  if (node.type === 'repository' && node.repository?.id) {
    return `repo-${node.repository.id}`;
  }
  return `${node.type}-${node.path}`;
}

interface RepositoryTreeNodeProps {
  node: TreeNode;
  level: number;
  selectedId?: string | null;
  onSelect: (repository: Repository) => void;
  expandedNodes: Set<string>;
  onToggle: (path: string) => void;
}

function RepositoryTreeNode({
  node,
  level,
  selectedId,
  onSelect,
  expandedNodes,
  onToggle,
}: RepositoryTreeNodeProps) {
  const isExpanded = expandedNodes.has(node.path);

  if (node.type === 'folder') {
    return (
      <FolderNode
        node={node}
        level={level}
        isExpanded={isExpanded}
        selectedId={selectedId}
        onSelect={onSelect}
        expandedNodes={expandedNodes}
        onToggle={onToggle}
      />
    );
  }

  return (
    <RepositoryNode
      node={node}
      level={level}
      isSelected={selectedId === node.repository?.id}
      onSelect={onSelect}
    />
  );
}

interface FolderNodeProps {
  node: TreeNode;
  level: number;
  isExpanded: boolean;
  selectedId?: string | null;
  onSelect: (repository: Repository) => void;
  expandedNodes: Set<string>;
  onToggle: (path: string) => void;
}

function FolderNode({
  node,
  level,
  isExpanded,
  selectedId,
  onSelect,
  expandedNodes,
  onToggle,
}: FolderNodeProps) {
  const paddingLeft = level * 16 + 8;

  return (
    <div>
      <button
        onClick={() => onToggle(node.path)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <ChevronIcon isExpanded={isExpanded} />
        <FolderIcon isOpen={isExpanded} />
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {node.children.length}
        </span>
      </button>

      {isExpanded && (
        <TreeNodeList
          nodes={node.children}
          level={level + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          expandedNodes={expandedNodes}
          onToggle={onToggle}
        />
      )}
    </div>
  );
}

interface RepositoryNodeProps {
  node: TreeNode;
  level: number;
  isSelected: boolean;
  onSelect: (repository: Repository) => void;
}

function getStuckNodeClassName(severity: string | undefined): string {
  if (severity === 'critical') {
    return 'bg-red-500/20 border-red-500 text-red-700 dark:text-red-300 ring-1 ring-red-500/50';
  }
  if (severity === 'high') {
    return 'bg-orange-500/15 border-orange-500 text-orange-700 dark:text-orange-300';
  }
  return 'bg-red-500/10 border-red-400 text-red-600 dark:text-red-400';
}

function getStuckIconClassName(severity: string | undefined): string {
  if (severity === 'critical') return 'text-red-500 animate-bounce';
  if (severity === 'high') return 'text-orange-500';
  return 'text-red-400';
}

function RepositoryNodeIcon({
  isStuck,
  severity,
}: {
  isStuck: boolean;
  severity?: string;
}) {
  if (isStuck) {
    return (
      <AlertTriangle
        className={cn('h-4 w-4 shrink-0', getStuckIconClassName(severity))}
      />
    );
  }
  return <GitBranch className="h-4 w-4 shrink-0" />;
}

function getRepoNodeClasses(
  isSelected: boolean,
  isStuck: boolean,
  severity?: string
): string {
  const baseClass =
    'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors';

  if (isStuck) {
    return cn(
      baseClass,
      'border-l-2 animate-pulse',
      getStuckNodeClassName(severity)
    );
  }
  if (isSelected) {
    return cn(
      baseClass,
      'bg-primary/10 text-primary border-l-2 border-primary'
    );
  }
  return cn(baseClass, 'hover:bg-muted/50');
}

function RepositoryNode({
  node,
  level,
  isSelected,
  onSelect,
}: RepositoryNodeProps) {
  const paddingLeft = level * 16 + 32;
  const repo = node.repository!;
  const { getAlertForRepo } = useStuckDetection();
  const stuckAlert = getAlertForRepo(repo.id);
  const isStuck = Boolean(stuckAlert && !stuckAlert.acknowledged);

  return (
    <button
      onClick={() => onSelect(repo)}
      className={getRepoNodeClasses(isSelected, isStuck, stuckAlert?.severity)}
      style={{ paddingLeft: `${paddingLeft}px` }}
    >
      <RepositoryNodeIcon isStuck={isStuck} severity={stuckAlert?.severity} />
      <span className="flex-1 truncate text-left">{node.name}</span>
      {isStuck && stuckAlert ? (
        <StuckBadge severity={stuckAlert.severity} />
      ) : (
        <RepositoryStatusBadge isClean={repo.isClean ?? false} />
      )}
    </button>
  );
}

interface StuckBadgeProps {
  severity: string;
}

function StuckBadge({ severity }: StuckBadgeProps) {
  const isCritical = severity === 'critical';
  const isHigh = severity === 'high';

  return (
    <Badge
      variant="destructive"
      className={cn(
        'shrink-0 text-xs',
        isCritical && 'animate-pulse bg-red-600',
        isHigh && 'bg-orange-500'
      )}
    >
      {isCritical ? '!' : isHigh ? '?' : '•'}
    </Badge>
  );
}

interface ChevronIconProps {
  isExpanded: boolean;
}

function ChevronIcon({ isExpanded }: ChevronIconProps) {
  return isExpanded ? (
    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
  ) : (
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  );
}

interface FolderIconProps {
  isOpen: boolean;
}

function FolderIcon({ isOpen }: FolderIconProps) {
  return isOpen ? (
    <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
  ) : (
    <Folder className="h-4 w-4 shrink-0 text-blue-500" />
  );
}

interface RepositoryStatusBadgeProps {
  isClean: boolean;
}

function RepositoryStatusBadge({ isClean }: RepositoryStatusBadgeProps) {
  return (
    <Badge
      variant={isClean ? 'default' : 'secondary'}
      className="shrink-0 text-xs"
    >
      {isClean ? '✓' : '•'}
    </Badge>
  );
}
