'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import type {
  QAGate,
  QAGateExecutionResult,
} from '../types/qa-gates';

interface QAGateCardProps {
  gate: QAGate;
  index: number;
  execution?: QAGateExecutionResult;
  variant?: 'active' | 'disabled';
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const badges: Record<string, React.ReactElement | null> = {
    running: (
      <Badge className="h-7 border border-blue-500/30 bg-blue-500/15 px-4 text-sm font-semibold text-blue-700 dark:text-blue-400">
        Running
      </Badge>
    ),
    passed: (
      <Badge className="h-7 border border-green-500/30 bg-green-500/15 px-4 text-sm font-semibold text-green-700 dark:text-green-400">
        Passed
      </Badge>
    ),
    failed: (
      <Badge className="h-7 border border-red-500/30 bg-red-500/15 px-4 text-sm font-semibold text-red-700 dark:text-red-400">
        Failed
      </Badge>
    ),
    skipped: (
      <Badge variant="outline" className="h-7 px-4 text-sm font-semibold">
        Skipped
      </Badge>
    ),
  };

  return badges[status] || null;
}

function OutputSection({
  output,
  label,
  isError = false,
}: {
  output: string;
  label: string;
  isError?: boolean;
}) {
  const containerClass = isError
    ? 'overflow-x-auto rounded-lg border border-red-200 bg-red-50/50 px-6 py-5 font-mono text-sm dark:border-red-900/30 dark:bg-red-950/20'
    : 'overflow-x-auto rounded-lg border bg-muted/50 px-6 py-5 font-mono text-sm';

  const textClass = isError
    ? 'whitespace-pre-wrap break-words text-red-900 dark:text-red-400'
    : 'whitespace-pre-wrap break-words text-muted-foreground';

  const labelClass = isError
    ? 'mb-3 text-base font-bold text-red-600'
    : 'mb-3 text-base font-bold text-muted-foreground';

  return (
    <div>
      <div className={labelClass}>{label}</div>
      <div className={containerClass}>
        <pre className={textClass}>{output}</pre>
      </div>
    </div>
  );
}

function ExecutionOutput({
  execution,
  expanded,
  onToggle,
}: {
  execution: QAGateExecutionResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!execution.output && !execution.error) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg border-2 bg-muted/30 px-4 py-3 text-left font-semibold transition-colors hover:bg-muted/50"
      >
        <span className="text-sm text-muted-foreground">
          {expanded ? 'Hide Output' : 'Show Output'}
        </span>
        <span className="text-muted-foreground">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
          {execution.output && (
            <OutputSection output={execution.output} label="Output:" />
          )}
          {execution.error && (
            <OutputSection output={execution.error} label="Error:" isError />
          )}
        </div>
      )}
    </div>
  );
}

function GateStatusBadges({
  execution,
  isDisabled,
  failOnError,
}: {
  execution?: QAGateExecutionResult;
  isDisabled: boolean;
  failOnError: boolean;
}) {
  if (execution) {
    return (
      <>
        <ExecutionStatusBadge status={execution.status} />
        {execution.duration && (
          <span className="text-base font-semibold text-muted-foreground">
            {(execution.duration / 1000).toFixed(2)}s
          </span>
        )}
      </>
    );
  }

  if (isDisabled) {
    return (
      <Badge variant="outline" className="h-7 px-4 text-sm">
        Disabled
      </Badge>
    );
  }

  return (
    <>
      <Badge variant="secondary" className="h-7 px-4 text-sm font-semibold">
        Active
      </Badge>
      {failOnError && (
        <Badge className="h-7 border-2 border-primary/50 bg-primary/20 px-4 text-sm font-bold text-primary">
          Blocks
        </Badge>
      )}
    </>
  );
}

function GateHeader({
  gate,
  index,
  isDisabled,
  execution,
}: {
  gate: QAGate;
  index: number;
  isDisabled: boolean;
  execution?: QAGateExecutionResult;
}) {
  const numberClass = isDisabled
    ? 'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-base font-semibold text-muted-foreground'
    : 'flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm text-base font-bold';

  const titleClass = isDisabled ? 'text-lg font-medium' : 'text-xl font-semibold';

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <div className={numberClass}>
          <span>{gate.order ?? index + 1}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <CardTitle className={titleClass}>{gate.name}</CardTitle>
            <span className="text-base text-muted-foreground">
              {(gate.timeout / 1000).toFixed(0)}s timeout
            </span>
          </div>

          <div className="flex items-center gap-3">
            <GateStatusBadges
              execution={execution}
              isDisabled={isDisabled}
              failOnError={gate.failOnError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function QAGateCard({
  gate,
  index,
  execution,
  variant = 'active',
}: QAGateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isDisabled = variant === 'disabled';

  const cardClassName = isDisabled
    ? 'border-dashed opacity-60 transition-opacity hover:opacity-80'
    : 'relative border-l-4 border-l-primary transition-all hover:shadow-lg';

  return (
    <Card className={cardClassName}>
      <CardHeader className="px-6 pb-5 pt-6">
        <GateHeader
          gate={gate}
          index={index}
          isDisabled={isDisabled}
          execution={execution}
        />
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6 pt-0">
        <div className="rounded-lg border-2 bg-muted/60 px-6 py-5 font-mono text-base shadow-sm">
          <code className="font-medium text-foreground">{gate.command}</code>
        </div>

        {execution && (
          <ExecutionOutput
            execution={execution}
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
          />
        )}
      </CardContent>
    </Card>
  );
}
