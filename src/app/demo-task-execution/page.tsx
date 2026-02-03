'use client';

import { useState } from 'react';
import { DiffViewer } from '@/features/diff-viewer/components';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import type { Task } from '@/db/schema/tasks';

/* eslint-disable max-lines-per-function, complexity */
export default function DemoTaskExecutionPage() {
  const [sessionId, setSessionId] = useState('demo-session-001');
  const [prompt, setPrompt] = useState('');
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Create and execute task
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, prompt }),
      });

      if (!res.ok) {
        throw new Error('Failed to create task');
      }

      const { task } = await res.json();
      setCurrentTask(task);

      // Start polling for updates
      pollTaskStatus(task.id);

      // Reset form
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  }

  async function pollTaskStatus(taskId: string) {
    const interval = setInterval(async () => {
      await pollTask(taskId, interval);
    }, 2000);
  }

  async function pollTask(taskId: string, interval: NodeJS.Timeout) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) {
        clearInterval(interval);
        return;
      }

      const { task } = await res.json();
      setCurrentTask(task);

      if (isTerminalStatus(task.status)) {
        clearInterval(interval);
      }
    } catch (err) {
      console.error('Failed to poll task status:', err);
      clearInterval(interval);
    }
  }

  function isTerminalStatus(status: string) {
    return (
      status === 'waiting_approval' ||
      status === 'completed' ||
      status === 'failed' ||
      status === 'cancelled' ||
      status === 'qa_failed'
    );
  }

  function getStatusColor(status: string) {
    const statusColors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      pre_flight: 'bg-blue-100 text-blue-800',
      running: 'bg-blue-100 text-blue-800',
      waiting_qa: 'bg-yellow-100 text-yellow-800',
      qa_running: 'bg-yellow-100 text-yellow-800',
      waiting_approval: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      qa_failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    return statusColors[status] || 'bg-gray-100 text-gray-800';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Task Execution Demo
          </h1>
          <p className="text-gray-600 mb-4">
            Feature 2: Send prompts to Claude and monitor execution with
            automatic QA gates
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Prompt Input */}
          <Card className="lg:col-span-1 p-6">
            <h2 className="text-lg font-semibold mb-4">Create Task</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session ID
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What should Claude do?"
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || !prompt.trim()}
                className="w-full"
              >
                {loading ? 'Creating Task...' : 'Send to Claude'}
              </Button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          </Card>

          {/* Task Status */}
          <Card className="lg:col-span-2 p-6">
            <h2 className="text-lg font-semibold mb-4">Current Task</h2>

            {!currentTask && (
              <div className="text-center py-12 text-gray-400">
                <svg
                  className="mx-auto h-16 w-16 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p>No active task</p>
              </div>
            )}

            {currentTask && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(currentTask.status)}`}
                    >
                      {currentTask.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Task ID: {currentTask.id.slice(0, 8)}...
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Prompt
                  </h3>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                    {currentTask.prompt}
                  </p>
                </div>

                {currentTask.claudeOutput && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Claude Output
                    </h3>
                    <pre className="text-xs text-gray-900 bg-gray-50 p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap">
                      {currentTask.claudeOutput}
                    </pre>
                  </div>
                )}

                {currentTask.currentQAAttempt && currentTask.currentQAAttempt > 1 && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      QA Retry Attempt: {currentTask.currentQAAttempt} / 3
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Diff Viewer */}
        {currentTask &&
          (currentTask.status === 'waiting_approval' ||
            currentTask.status === 'completed') && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Changes Review</h2>
              <div className="h-[600px]">
                <DiffViewer taskId={currentTask.id} />
              </div>
            </Card>
          )}

        {/* Feature Highlights */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            Feature Highlights
          </h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Task creation and execution</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Real-time status updates</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Automatic QA gate execution</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>QA gate retry (up to 3 attempts)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Pre-flight git checks</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">✓</span>
              <span>Integrated diff viewer</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
