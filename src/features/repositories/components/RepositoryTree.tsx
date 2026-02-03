'use client';

import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  GitBranch,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
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
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/50 rounded transition-colors"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        <ChevronIcon isExpanded={isExpanded} />
        <FolderIcon isOpen={isExpanded} />
        <span className="truncate font-medium">{node.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">
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

function RepositoryNode({
  node,
  level,
  isSelected,
  onSelect,
}: RepositoryNodeProps) {
  const paddingLeft = level * 16 + 32;
  const repo = node.repository!;

  return (
    <button
      onClick={() => onSelect(repo)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
        isSelected
          ? 'bg-primary/10 text-primary border-l-2 border-primary'
          : 'hover:bg-muted/50'
      }`}
      style={{ paddingLeft: `${paddingLeft}px` }}
    >
      <GitBranch className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1 text-left">{node.name}</span>
      <RepositoryStatusBadge isClean={repo.isClean ?? false} />
    </button>
  );
}

interface ChevronIconProps {
  isExpanded: boolean;
}

function ChevronIcon({ isExpanded }: ChevronIconProps) {
  return isExpanded ? (
    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
  ) : (
    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
  );
}

interface FolderIconProps {
  isOpen: boolean;
}

function FolderIcon({ isOpen }: FolderIconProps) {
  return isOpen ? (
    <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
  ) : (
    <Folder className="h-4 w-4 text-blue-500 shrink-0" />
  );
}

interface RepositoryStatusBadgeProps {
  isClean: boolean;
}

function RepositoryStatusBadge({ isClean }: RepositoryStatusBadgeProps) {
  return (
    <Badge
      variant={isClean ? 'default' : 'secondary'}
      className="text-xs shrink-0"
    >
      {isClean ? '✓' : '•'}
    </Badge>
  );
}
