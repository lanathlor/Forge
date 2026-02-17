'use client';

import { DiffViewer } from '@/features/diff-viewer/components';
import { useState } from 'react';

/* eslint-disable max-lines-per-function */
export default function DemoDiffViewerPage() {
  const [taskId, setTaskId] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Diff Viewer Demo
          </h1>
          <p className="mb-4 text-gray-600">
            Feature 4: Visual code comparison tool with syntax highlighting and
            side-by-side diff viewing
          </p>

          <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              Enter a Task ID to view its diff
            </h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                placeholder="Enter task ID..."
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  // Task ID is already set
                }}
                disabled={!taskId}
                className="rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Load Diff
              </button>
            </div>
          </div>
        </div>

        {taskId && (
          <div className="h-[800px] overflow-hidden rounded-lg bg-white shadow-lg">
            <DiffViewer taskId={taskId} />
          </div>
        )}

        {!taskId && (
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <div className="mb-4 text-gray-400">
              <svg
                className="mx-auto h-24 w-24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No task selected
            </h3>
            <p className="text-gray-500">
              Enter a task ID above to view its diff
            </p>
          </div>
        )}
      </div>

      <div className="mx-auto mt-8 max-w-7xl p-8">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-blue-900">
            Feature Highlights
          </h2>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Side-by-side diff comparison with Monaco Editor</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                Syntax highlighting for multiple programming languages
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>File tree navigation with change indicators</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Change statistics (insertions/deletions)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>
                Support for added, modified, deleted, and renamed files
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
