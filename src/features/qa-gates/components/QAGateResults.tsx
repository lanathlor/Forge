'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { QAGateStatus } from '@/db/schema/qa-gates';
import { ErrorState } from '@/shared/components/error';
import { useToast } from '@/shared/components/ui/toast';
import { useErrorToast } from '@/shared/components/error';

interface QAGateResultsProps {
  taskId: string;
  attempt?: number;
  maxAttempts?: number;
}

interface GateDisplay {
  gateName: string;
  status: QAGateStatus;
  output: string;
  errors: string[];
  duration: number;
}

// Helper functions
function getGateIcon(status: QAGateStatus): string {
  switch (status) {
    case 'passed':
      return '✅';
    case 'failed':
      return '❌';
    case 'skipped':
      return '⏭️';
    case 'running':
      return '⏳';
    default:
      return '⏸️';
  }
}

function getStatusVariant(
  status: QAGateStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'passed':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'skipped':
      return 'secondary';
    default:
      return 'outline';
  }
}

// Sub-components
interface StatusBadgeProps {
  status: QAGateStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={getStatusVariant(status)}>{status}</Badge>;
}

interface GateStatusMessageProps {
  status: QAGateStatus;
}

function GateStatusMessage({ status }: GateStatusMessageProps) {
  if (status === 'passed') {
    return (
      <p className="text-sm text-muted-foreground">
        No errors or warnings found
      </p>
    );
  }

  if (status === 'skipped') {
    return (
      <p className="text-sm text-muted-foreground">
        Skipped (previous gate failed)
      </p>
    );
  }

  return null;
}

interface GateDetailsToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

function GateDetailsToggle({ isExpanded, onToggle }: GateDetailsToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded border bg-muted/30 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/50"
    >
      <span className="text-muted-foreground">
        {isExpanded ? 'Hide Details' : 'Show Details'}
      </span>
      <span className="text-muted-foreground">{isExpanded ? '▼' : '▶'}</span>
    </button>
  );
}

interface GateOutputProps {
  output: string;
}

function GateOutput({ output }: GateOutputProps) {
  if (!output) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted-foreground">
        Output:
      </p>
      <div className="overflow-x-auto rounded border bg-muted/50 p-3 font-mono text-xs">
        <pre className="whitespace-pre-wrap break-words text-muted-foreground">
          {output}
        </pre>
      </div>
    </div>
  );
}

interface GateErrorsProps {
  errors: string[];
}

function GateErrors({ errors }: GateErrorsProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-destructive">
        {errors.length} error{errors.length > 1 ? 's' : ''} found:
      </p>
      <div className="space-y-1">
        {errors.map((error, idx) => (
          <p
            key={idx}
            className="rounded bg-muted p-2 font-mono text-xs text-muted-foreground"
          >
            {error}
          </p>
        ))}
      </div>
    </div>
  );
}

interface GateDetailsProps {
  output: string;
  errors: string[];
}

function GateDetails({ output, errors }: GateDetailsProps) {
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
      <GateOutput output={output} />
      <GateErrors errors={errors} />
    </div>
  );
}

interface GateResultItemProps {
  result: GateDisplay;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function GateResultItem({
  result,
  isExpanded,
  onToggleExpand,
}: GateResultItemProps) {
  const hasDetails =
    result.output || (result.errors && result.errors.length > 0);

  return (
    <div className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <span className="font-medium">
              {getGateIcon(result.status)} {result.gateName}
            </span>
            <StatusBadge status={result.status} />
            <span className="text-sm text-muted-foreground">
              {(result.duration / 1000).toFixed(1)}s
            </span>
          </div>

          <GateStatusMessage status={result.status} />

          {hasDetails && (
            <div className="mt-3 space-y-2">
              <GateDetailsToggle
                isExpanded={isExpanded}
                onToggle={onToggleExpand}
              />
              {isExpanded && (
                <GateDetails output={result.output} errors={result.errors} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultsHeaderProps {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  attempt: number;
  maxAttempts: number;
  onRerun: () => void;
}

function ResultsHeader({
  allPassed,
  passedCount,
  totalCount,
  attempt,
  maxAttempts,
  onRerun,
}: ResultsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">QA Gate Results</h3>
        {!allPassed && (
          <p className="text-sm text-muted-foreground">
            Attempt {attempt} of {maxAttempts}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={allPassed ? 'default' : 'destructive'}>
          {allPassed
            ? '✅ ALL PASSED'
            : `❌ FAILED (${passedCount}/${totalCount} passed)`}
        </Badge>
        <Button variant="outline" size="sm" onClick={onRerun}>
          Re-run Gates
        </Button>
      </div>
    </div>
  );
}

interface ResultsFooterProps {
  attempt: number;
  maxAttempts: number;
  onRerun: () => void;
}

function ResultsFooter({ attempt, maxAttempts, onRerun }: ResultsFooterProps) {
  const maxAttemptsReached = attempt >= maxAttempts;

  return (
    <div className="border-t pt-4">
      {maxAttemptsReached ? (
        <p className="mb-3 text-sm text-destructive">
          ⚠️ Maximum retry attempts ({maxAttempts}) reached. You can manually
          fix the issues and re-run, or override to approve anyway.
        </p>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          🔧 QA gates failed. Fix the issues manually and re-run the gates.
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onRerun}>
          Fix & Re-run
        </Button>
        {maxAttemptsReached && (
          <Button variant="secondary">Override & Approve Anyway</Button>
        )}
      </div>
    </div>
  );
}

// Custom hooks
function useQAGateResults(taskId: string) {
  const [results, setResults] = useState<GateDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { addToast } = useToast();
  const showError = useErrorToast(addToast);

  const loadResults = useCallback(async () => {
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(`/api/tasks/${taskId}/qa-gates/results`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');

      if (error.name === 'AbortError') {
        console.error('Request timeout: QA gate results took too long to load');
        setError(new Error('Request timed out'));
        showError.timeout(undefined, loadResults);
      } else {
        console.error('Failed to load QA gate results:', error);
        setError(error);
        showError.fromError(error, loadResults);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, addToast, showError]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  async function rerunGates() {
    setLoading(true);
    setError(null);
    try {
      // Start the QA retry in the background
      const res = await fetch(`/api/tasks/${taskId}/qa-gates/run`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to start QA retry');
      }

      // Don't wait for results - the POST returns immediately
      // Instead, reload results after a short delay to show progress
      setTimeout(() => {
        loadResults();
      }, 1000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      console.error('Failed to re-run QA gates:', error);
      setError(error);
      showError.fromError(error, rerunGates);
      setLoading(false);
    }
    // Keep loading state true - it will be cleared by loadResults()
  }

  return { results, loading, error, rerunGates };
}

function useExpandedGates() {
  const [expandedGates, setExpandedGates] = useState<Set<string>>(new Set());

  function toggleExpanded(gateName: string) {
    const newExpanded = new Set(expandedGates);
    if (newExpanded.has(gateName)) {
      newExpanded.delete(gateName);
    } else {
      newExpanded.add(gateName);
    }
    setExpandedGates(newExpanded);
  }

  return { expandedGates, toggleExpanded };
}

function LoadingView() {
  return (
    <Card className="p-6">
      <p className="text-muted-foreground">Loading QA gate results...</p>
    </Card>
  );
}

interface ResultsViewProps {
  results: GateDisplay[];
  expandedGates: Set<string>;
  allPassed: boolean;
  passedCount: number;
  attempt: number;
  maxAttempts: number;
  onRerun: () => void;
  onToggleExpand: (gateName: string) => void;
}

function ResultsView({
  results,
  expandedGates,
  allPassed,
  passedCount,
  attempt,
  maxAttempts,
  onRerun,
  onToggleExpand,
}: ResultsViewProps) {
  const showFooter = !allPassed;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <ResultsHeader
          allPassed={allPassed}
          passedCount={passedCount}
          totalCount={results.length}
          attempt={attempt}
          maxAttempts={maxAttempts}
          onRerun={onRerun}
        />

        <div className="space-y-3">
          {results.map((result) => (
            <GateResultItem
              key={result.gateName}
              result={result}
              isExpanded={expandedGates.has(result.gateName)}
              onToggleExpand={() => onToggleExpand(result.gateName)}
            />
          ))}
        </div>

        {showFooter && (
          <ResultsFooter
            attempt={attempt}
            maxAttempts={maxAttempts}
            onRerun={onRerun}
          />
        )}
      </div>
    </Card>
  );
}

// Main component
export function QAGateResults({
  taskId,
  attempt = 1,
  maxAttempts = 3,
}: QAGateResultsProps) {
  const { results, loading, error, rerunGates } = useQAGateResults(taskId);
  const { expandedGates, toggleExpanded } = useExpandedGates();

  if (loading && !error) {
    return <LoadingView />;
  }

  if (error) {
    const errorType = error.message.includes('timed out')
      ? 'timeout'
      : error.message.includes('HTTP 5')
        ? 'server'
        : 'network';

    return (
      <ErrorState
        type={errorType}
        title="Failed to Load QA Gate Results"
        message={error.message}
        onRetry={rerunGates}
        size="md"
      />
    );
  }

  const passedCount = results.filter((r) => r.status === 'passed').length;
  const allPassed = results.every(
    (r) => r.status === 'passed' || r.status === 'skipped'
  );

  return (
    <ResultsView
      results={results}
      expandedGates={expandedGates}
      allPassed={allPassed}
      passedCount={passedCount}
      attempt={attempt}
      maxAttempts={maxAttempts}
      onRerun={rerunGates}
      onToggleExpand={toggleExpanded}
    />
  );
}
