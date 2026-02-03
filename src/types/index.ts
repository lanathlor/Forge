// File changes
export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
  patch: string;
}

// Diff result
export interface DiffResult {
  fullDiff: string;
  changedFiles: FileChange[];
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

// Git commit info
export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
}

// Discovered repository
export interface DiscoveredRepository {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
  lastCommit: CommitInfo;
  isClean: boolean;
  uncommittedFiles: string[];
}

// Pre-flight check result
export interface PreFlightResult {
  passed: boolean;
  currentCommit: string;
  currentBranch: string;
  isClean: boolean;
  error?: string;
}

// Claude task result
export interface ClaudeTaskResult {
  exitCode: number;
  output: string;
  error?: string;
}

// QA gate execution result
export interface QAGateExecutionResult {
  gateName: string;
  status: 'passed' | 'failed' | 'skipped';
  output: string;
  errors?: string[];
  duration: number;
}
