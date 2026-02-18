'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Play, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';

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

export function TestGateButton({
  repositoryId,
  gateName,
  command,
}: TestGateButtonProps) {
  const [showOutput, setShowOutput] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleTest() {
    setShowOutput(true);
    setResult({
      status: 'running',
      output: '',
      error: null,
      exitCode: null,
      duration: null,
    });

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

  const getButtonIcon = () => {
    if (!result) return <Play className="h-3.5 w-3.5" />;
    if (result.status === 'running')
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (result.status === 'passed')
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (result.status === 'failed')
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    return <Play className="h-3.5 w-3.5" />;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleTest}
        title="Test this gate"
        disabled={result?.status === 'running'}
      >
        {getButtonIcon()}
      </Button>

      <Dialog open={showOutput} onOpenChange={setShowOutput}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Test Gate: {gateName}
              {result && result.status !== 'running' && (
                result.status === 'passed' ? (
                  <Badge className="h-5 border border-green-500/30 bg-green-500/15 px-2 text-xs font-semibold text-green-700 dark:text-green-400">
                    Passed
                  </Badge>
                ) : (
                  <Badge className="h-5 border border-red-500/30 bg-red-500/15 px-2 text-xs font-semibold text-red-700 dark:text-red-400">
                    Failed
                  </Badge>
                )
              )}
            </DialogTitle>
            <DialogDescription className="rounded-md bg-muted/50 p-2 font-mono text-xs">
              {command}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {result && (
              <>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    {result.status === 'running' && (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="font-semibold text-blue-600">
                          Running...
                        </span>
                      </>
                    )}
                    {result.status === 'passed' && (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-600">
                          Passed
                        </span>
                        {result.exitCode != null && (
                          <span className="text-xs text-muted-foreground">(exit {result.exitCode})</span>
                        )}
                      </>
                    )}
                    {result.status === 'failed' && (
                      <>
                        <XCircle className="h-5 w-5 text-red-600" />
                        <span className="font-semibold text-red-600">
                          Failed
                        </span>
                        {result.exitCode != null && (
                          <span className="text-xs text-muted-foreground">(exit {result.exitCode})</span>
                        )}
                      </>
                    )}
                  </div>
                  {result.duration != null && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-mono font-semibold">
                        {(result.duration / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                </div>

                {result.output && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Output
                    </div>
                    <div className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-4">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                        {result.output}
                      </pre>
                    </div>
                  </div>
                )}
                {result.error && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">
                      Error
                    </div>
                    <div className="max-h-64 overflow-auto rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-950/20">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-900 dark:text-red-400">
                        {result.error}
                      </pre>
                    </div>
                  </div>
                )}

                {result.status !== 'running' && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleTest} className="gap-1.5">
                      <Play className="h-3.5 w-3.5" />
                      Re-run
                    </Button>
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
