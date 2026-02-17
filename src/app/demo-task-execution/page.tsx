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
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Task Execution Demo
          </h1>
          <p className="mb-4 text-gray-600">
            Feature 2: Send prompts to Claude and monitor execution with
            automatic QA gates
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Prompt Input */}
          <Card className="p-6 lg:col-span-1">
            <h2 className="mb-4 text-lg font-semibold">Create Task</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Session ID
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What should Claude do?"
                  rows={6}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>
          </Card>

          {/* Task Status */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Current Task</h2>

            {!currentTask && (
              <div className="py-12 text-center text-gray-400">
                <svg
                  className="mx-auto mb-4 h-16 w-16"
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
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(currentTask.status)}`}
                    >
                      {currentTask.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Task ID: {currentTask.id.slice(0, 8)}...
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    Prompt
                  </h3>
                  <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-900">
                    {currentTask.prompt}
                  </p>
                </div>

                {currentTask.claudeOutput && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      Claude Output
                    </h3>
                    <pre className="max-h-64 overflow-x-auto overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-900">
                      {currentTask.claudeOutput}
                    </pre>
                  </div>
                )}

                {currentTask.currentQAAttempt &&
                  currentTask.currentQAAttempt > 1 && (
                    <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
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
              <h2 className="mb-4 text-lg font-semibold">Changes Review</h2>
              <div className="h-[600px]">
                <DiffViewer taskId={currentTask.id} />
              </div>
            </Card>
          )}

        {/* Feature Highlights */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-blue-900">
            Feature Highlights
          </h2>
          <ul className="grid grid-cols-1 gap-2 text-blue-800 md:grid-cols-2">
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
