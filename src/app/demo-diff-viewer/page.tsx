'use client';

import { DiffViewer } from '@/features/diff-viewer/components';
import { useState } from 'react';

/* eslint-disable max-lines-per-function */
export default function DemoDiffViewerPage() {
  const [taskId, setTaskId] = useState('');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Diff Viewer Demo
          </h1>
          <p className="text-gray-600 mb-4">
            Feature 4: Visual code comparison tool with syntax highlighting and
            side-by-side diff viewing
          </p>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Enter a Task ID to view its diff
            </h2>
            <div className="flex gap-4">
              <input
                type="text"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                placeholder="Enter task ID..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => {
                  // Task ID is already set
                }}
                disabled={!taskId}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Load Diff
              </button>
            </div>
          </div>
        </div>

        {taskId && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden h-[800px]">
            <DiffViewer taskId={taskId} />
          </div>
        )}

        {!taskId && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No task selected
            </h3>
            <p className="text-gray-500">
              Enter a task ID above to view its diff
            </p>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto p-8 mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            Feature Highlights
          </h2>
          <ul className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Side-by-side diff comparison with Monaco Editor</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Syntax highlighting for multiple programming languages</span>
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
              <span>Support for added, modified, deleted, and renamed files</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
