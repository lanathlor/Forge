import type { Repository } from '@/db/schema';

export interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'repository';
  repository?: Repository;
  children: TreeNode[];
  isExpanded?: boolean;
}

function createFolderNode(name: string, path: string): TreeNode {
  return {
    name,
    path,
    type: 'folder',
    children: [],
    isExpanded: false,
  };
}

function findOrCreateFolderNode(
  parent: TreeNode,
  name: string,
  path: string
): TreeNode {
  let childNode = parent.children.find(
    (c) => c.name === name && c.type === 'folder'
  );

  if (!childNode) {
    childNode = createFolderNode(name, path);
    parent.children.push(childNode);
  }

  return childNode;
}

function addRepositoryNode(
  parent: TreeNode,
  name: string,
  repo: Repository
): void {
  parent.children.push({
    name,
    path: repo.path,
    type: 'repository',
    repository: repo,
    children: [],
  });
}

function processRepositoryPath(
  repo: Repository,
  root: TreeNode,
  commonBase: string
): void {
  const relativePath = repo.path.replace(commonBase, '').replace(/^\//, '');
  const parts = relativePath.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) return;

  let currentNode = root;
  let currentPath = commonBase;

  // Create folder nodes for path segments (except last one which is the repo)
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;

    currentPath = `${currentPath}/${part}`;
    currentNode = findOrCreateFolderNode(currentNode, part, currentPath);
  }

  // Add repository as leaf node
  const repoName = parts[parts.length - 1];
  if (repoName) {
    addRepositoryNode(currentNode, repoName, repo);
  }
}

/**
 * Build a tree structure from flat repository list
 * Groups repositories by their parent directories
 */
export function buildRepositoryTree(repositories: Repository[]): TreeNode {
  const root: TreeNode = {
    name: 'workspace',
    path: '',
    type: 'folder',
    children: [],
    isExpanded: true,
  };

  const paths = repositories.map((r) => r.path);
  const commonBase = findCommonBasePath(paths);

  // Build tree
  for (const repo of repositories) {
    processRepositoryPath(repo, root, commonBase);
  }

  // Sort: folders first, then alphabetically
  sortTree(root);

  return root;
}

/**
 * Find common base path from all repository paths
 */
function findCommonBasePath(paths: string[]): string {
  if (paths.length === 0) return '';
  if (paths.length === 1) {
    // Return parent directory
    const parts = paths[0]?.split('/') ?? [];
    return parts.slice(0, -1).join('/');
  }

  const sortedPaths = [...paths].sort();
  const first = sortedPaths[0];
  const last = sortedPaths[sortedPaths.length - 1];

  if (!first || !last) return '';

  let commonPath = '';
  const firstParts = first.split('/');
  const lastParts = last.split('/');

  for (let i = 0; i < firstParts.length - 1; i++) {
    if (firstParts[i] === lastParts[i]) {
      commonPath += (i > 0 ? '/' : '') + firstParts[i];
    } else {
      break;
    }
  }

  return commonPath;
}

/**
 * Sort tree nodes: folders first, then alphabetically
 */
function sortTree(node: TreeNode): void {
  node.children.sort((a, b) => {
    // Folders before repositories
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    // Alphabetically within same type
    return a.name.localeCompare(b.name);
  });

  // Recursively sort children
  for (const child of node.children) {
    if (child.type === 'folder') {
      sortTree(child);
    }
  }
}

/**
 * Count total repositories in tree
 */
export function countRepositories(node: TreeNode): number {
  let count = node.type === 'repository' ? 1 : 0;
  for (const child of node.children) {
    count += countRepositories(child);
  }
  return count;
}

/**
 * Find repository node by ID
 */
export function findRepositoryNode(
  node: TreeNode,
  repoId: string
): TreeNode | null {
  if (node.type === 'repository' && node.repository?.id === repoId) {
    return node;
  }

  for (const child of node.children) {
    const found = findRepositoryNode(child, repoId);
    if (found) return found;
  }

  return null;
}
