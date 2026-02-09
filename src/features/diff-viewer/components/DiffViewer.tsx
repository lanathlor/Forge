'use client';

import { useState, useEffect, useCallback } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import type { DiffResult, FileChange } from '@/lib/git/diff';
import { FileTree } from './FileTree';
import { DiffStats } from './DiffStats';

interface DiffViewerProps {
  taskId: string;
}

/* eslint-disable max-lines-per-function */
export function DiffViewer({ taskId }: DiffViewerProps) {
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [fileContent, setFileContent] = useState<{
    before: string;
    after: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks/${taskId}/diff`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Failed to load diff';
        const details = errorData.details ? ` (${errorData.details})` : '';
        console.error(`[DiffViewer] Failed to load diff for task ${taskId}:`, errorMsg, details);
        throw new Error(`${errorMsg}${details}`);
      }
      const data = await res.json();
      console.log(`[DiffViewer] Loaded diff for task ${taskId}:`, {
        filesChanged: data.changedFiles?.length || 0,
        stats: data.stats,
      });
      setDiff(data);

      // Auto-select first file
      if (data.changedFiles && data.changedFiles.length > 0) {
        setSelectedFile(data.changedFiles[0]);
      }
    } catch (err) {
      console.error(`[DiffViewer] Error loading diff:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const loadFileContent = useCallback(async (path: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/files/${path}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Failed to load file content';
        console.error(`[DiffViewer] Failed to load file content for ${path}:`, errorMsg);
        throw new Error(errorMsg);
      }
      const data = await res.json();
      console.log(`[DiffViewer] Loaded file content for ${path}:`, {
        beforeLength: data.before?.length || 0,
        afterLength: data.after?.length || 0,
      });
      setFileContent(data);
    } catch (err) {
      console.error(`[DiffViewer] Error loading file content:`, err);
      setError(
        err instanceof Error ? err.message : 'Failed to load file content'
      );
    }
  }, [taskId]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile.path);
    }
  }, [selectedFile, loadFileContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading diff...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!diff || diff.changedFiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">No changes detected</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <DiffStats stats={diff.stats} />

      <div className="flex flex-1 overflow-hidden">
        {/* File Tree */}
        <FileTree
          files={diff.changedFiles}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />

        {/* Monaco Diff Editor */}
        <main className="flex-1 flex flex-col border-l border-gray-200">
          {selectedFile && fileContent && (
            <>
              <header className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{selectedFile.path}</h3>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      selectedFile.status === 'added'
                        ? 'bg-green-100 text-green-800'
                        : selectedFile.status === 'deleted'
                          ? 'bg-red-100 text-red-800'
                          : selectedFile.status === 'modified'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {selectedFile.status}
                  </span>
                </div>
              </header>

              <div className="flex-1">
                <DiffEditor
                  height="100%"
                  language={getLanguageFromPath(selectedFile.path)}
                  original={fileContent.before}
                  modified={fileContent.after}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 13,
                  }}
                  theme="vs-dark"
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html',
    py: 'python',
    rs: 'rust',
    go: 'go',
  };
  return langMap[ext || ''] || 'plaintext';
}
