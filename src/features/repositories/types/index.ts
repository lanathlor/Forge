export interface DiscoveredRepository {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    timestamp: Date;
  };
  isClean: boolean;
  uncommittedFiles: string[];
}

export interface RepositoryFilters {
  search?: string;
  isClean?: boolean;
  branch?: string;
}
