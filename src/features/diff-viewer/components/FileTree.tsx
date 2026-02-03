'use client';

import type { FileChange } from '@/lib/git/diff';

interface FileTreeProps {
  files: FileChange[];
  selectedFile: FileChange | null;
  onSelectFile: (file: FileChange) => void;
}

/* eslint-disable max-lines-per-function */
export function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
  // Group files by directory (future enhancement)
  buildFileTree(files);

  return (
    <aside className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-700">
          Changed Files ({files.length})
        </h3>
      </div>
      <div className="p-2">
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.path}>
              <button
                onClick={() => onSelectFile(file)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedFile?.path === file.path
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 text-base">
                    {file.status === 'added' && '✨'}
                    {file.status === 'modified' && '✏️'}
                    {file.status === 'deleted' && '🗑️'}
                    {file.status === 'renamed' && '📝'}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs">
                    {file.path}
                  </span>
                </div>
                <div className="mt-1 text-xs font-mono ml-6">
                  <span className="text-green-600">+{file.additions}</span>
                  {' '}
                  <span className="text-red-600">-{file.deletions}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 py-3 border-t border-gray-200 bg-white">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>New file</span>
          </div>
          <div className="flex items-center gap-2">
            <span>✏️</span>
            <span>Modified</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🗑️</span>
            <span>Deleted</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📝</span>
            <span>Renamed</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function buildFileTree(files: FileChange[]) {
  // For now, just return a flat list
  // In the future, this could build a hierarchical tree structure
  return files;
}
