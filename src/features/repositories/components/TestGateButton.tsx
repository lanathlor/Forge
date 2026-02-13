'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Play } from 'lucide-react';

interface TestGateButtonProps {
  repositoryId: string;
  gateName: string;
  command: string;
}

interface TestResult {
  status: 'running' | 'passed' | 'failed';
  output: string;
  error: string | null;
  exitCode: number | null;
  duration: number | null;
}

export function TestGateButton({ repositoryId, gateName, command }: TestGateButtonProps) {
  const [showOutput, setShowOutput] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleTest() {
    setShowOutput(true);
    setResult({ status: 'running', output: '', error: null, exitCode: null, duration: null });

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `/api/repositories/${repositoryId}/qa-gates/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command, gateName }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to test gate');
      }

      const data = await response.json();
      setResult({
        status: data.exitCode === 0 ? 'passed' : 'failed',
        output: data.output || '',
        error: data.error || null,
        exitCode: data.exitCode,
        duration: data.duration,
      });
    } catch (err) {
      setResult({
        status: 'failed',
        output: '',
        error: err instanceof Error ? err.message : 'Unknown error',
        exitCode: null,
        duration: null,
      });
    }
  }

  const statusColors = {
    running: 'text-blue-600',
    passed: 'text-green-600',
    failed: 'text-red-600',
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleTest}
        title="Test this gate"
      >
        <Play className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={showOutput} onOpenChange={setShowOutput}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test: {gateName}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {command}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {result && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-semibold ${statusColors[result.status]}`}>
                    {result.status === 'running' && (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Running...
                      </span>
                    )}
                    {result.status === 'passed' && 'Passed'}
                    {result.status === 'failed' && 'Failed'}
                  </span>
                  {result.duration != null && (
                    <span className="text-muted-foreground">
                      {(result.duration / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>

                {result.output && (
                  <div className="max-h-80 overflow-auto rounded-lg border bg-muted/50 p-4">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                      {result.output}
                    </pre>
                  </div>
                )}
                {result.error && (
                  <div className="max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
                    <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-700 dark:text-red-400">
                      {result.error}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
