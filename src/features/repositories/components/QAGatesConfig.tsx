'use client';

import { useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useQAGatesData } from './useQAGatesData';
import { QAGateCard } from './QAGateCard';
import { QARunControls } from './QARunControls';
import type {
  QAGatesConfigProps,
  QAGate,
  QARunStatusData,
} from '../types/qa-gates';

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Loading QA gates configuration...
        </p>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-destructive">
          Error Loading Configuration
        </CardTitle>
        <CardDescription className="text-destructive/80">
          {error}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-center">No QA Gates Configured</CardTitle>
        <CardDescription className="text-center">
          This repository does not have any quality assurance gates set up yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6 text-center">
        <div className="inline-flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-6">
          <svg
            className="h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="max-w-md text-sm text-muted-foreground">
            Create a{' '}
            <code className="rounded bg-background px-2 py-1 font-mono text-xs">
              .autobot.json
            </code>{' '}
            file in the repository root to configure quality gates.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineStats({
  totalGates,
  enabledGates,
  disabledGates,
}: {
  totalGates: number;
  enabledGates: number;
  disabledGates: number;
}) {
  return (
    <div className="flex items-center gap-12">
      <div className="flex items-center gap-3">
        <span className="text-base font-medium text-muted-foreground">
          Total:
        </span>
        <span className="text-2xl font-bold">{totalGates}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-base font-medium text-muted-foreground">
          Enabled:
        </span>
        <span className="text-2xl font-bold text-green-600">
          {enabledGates}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-base font-medium text-muted-foreground">
          Disabled:
        </span>
        <span className="text-2xl font-bold">{disabledGates}</span>
      </div>
    </div>
  );
}

function PipelineTitle({
  repositoryName,
  version,
  maxRetries,
}: {
  repositoryName: string;
  version: string;
  maxRetries: number;
}) {
  return (
    <CardHeader className="pb-6">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="mb-2 text-3xl font-bold">
            QA Gates Pipeline
          </CardTitle>
          <CardDescription className="text-base font-medium">
            {repositoryName}
          </CardDescription>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <span className="rounded-md bg-muted/50 px-3 py-1.5">
            v{version}
          </span>
          <span className="rounded-md bg-muted/50 px-3 py-1.5">
            Max retries: {maxRetries}
          </span>
        </div>
      </div>
    </CardHeader>
  );
}

function PipelineHeader({
  repositoryName,
  version,
  maxRetries,
  totalGates,
  enabledGates,
  disabledGates,
  runStatus,
  isRunning,
  onRun,
}: {
  repositoryName: string;
  version: string;
  maxRetries: number;
  totalGates: number;
  enabledGates: number;
  disabledGates: number;
  runStatus: QARunStatusData | null;
  isRunning: boolean;
  onRun: () => void;
}) {
  return (
    <Card>
      <PipelineTitle
        repositoryName={repositoryName}
        version={version}
        maxRetries={maxRetries}
      />
      <CardContent className="py-6">
        <div className="flex items-center justify-between">
          <PipelineStats
            totalGates={totalGates}
            enabledGates={enabledGates}
            disabledGates={disabledGates}
          />
          <QARunControls
            status={runStatus?.run?.status || null}
            hasRun={runStatus?.hasRun || false}
            isRunning={isRunning}
            enabledGatesCount={enabledGates}
            onRun={onRun}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function GatesList({
  title,
  gates,
  count,
  runStatus,
  variant,
}: {
  title: string;
  gates: QAGate[];
  count: number;
  runStatus: QARunStatusData | null;
  variant: 'active' | 'disabled';
}) {
  const badgeVariant = variant === 'active' ? 'secondary' : 'outline';
  const titleClass =
    variant === 'active'
      ? 'text-xl font-bold tracking-tight'
      : 'text-xl font-bold tracking-tight text-muted-foreground';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-1">
        <h3 className={titleClass}>{title}</h3>
        <Badge variant={badgeVariant} className="h-6 px-3 text-sm font-semibold">
          {count}
        </Badge>
      </div>

      <div className={variant === 'active' ? 'space-y-6' : 'grid gap-5'}>
        {gates.map((gate, index) => {
          const execution = runStatus?.gates.find(
            (g) => g.gateName === gate.name
          );

          return (
            <QAGateCard
              key={index}
              gate={gate}
              index={index}
              execution={execution}
              variant={variant}
            />
          );
        })}
      </div>
    </div>
  );
}

export function QAGatesConfig({ repositoryId }: QAGatesConfigProps) {
  console.log(`[QAGatesConfig Component] Rendering with repositoryId: ${repositoryId}`);

  useEffect(() => {
    console.log(`[QAGatesConfig Component] Mounted with repositoryId: ${repositoryId}`);
    return () => {
      console.log(`[QAGatesConfig Component] Unmounting for repositoryId: ${repositoryId}`);
    };
  }, [repositoryId]);

  const { config, isLoading, error, runStatus, isRunning, runQAGates } =
    useQAGatesData(repositoryId);

  console.log(`[QAGatesConfig Component] State - isLoading: ${isLoading}, error: ${error}, hasConfig: ${!!config}`);

  if (isLoading) {
    console.log(`[QAGatesConfig Component] Showing loading state for repositoryId: ${repositoryId}`);
    return <LoadingState />;
  }
  if (error) {
    console.log(`[QAGatesConfig Component] Showing error state for repositoryId: ${repositoryId}:`, error);
    return <ErrorState error={error} />;
  }
  if (!config) {
    console.log(`[QAGatesConfig Component] No config, returning null for repositoryId: ${repositoryId}`);
    return null;
  }

  const enabledGates = config.config.qaGates.filter((gate) => gate.enabled);
  const disabledGates = config.config.qaGates.filter((gate) => !gate.enabled);

  return (
    <div className="space-y-6">
      <PipelineHeader
        repositoryName={config.repository.name}
        version={config.config.version}
        maxRetries={config.config.maxRetries}
        totalGates={config.config.qaGates.length}
        enabledGates={enabledGates.length}
        disabledGates={disabledGates.length}
        runStatus={runStatus}
        isRunning={isRunning}
        onRun={runQAGates}
      />

      {enabledGates.length > 0 && (
        <GatesList
          title="Active Pipeline"
          gates={enabledGates}
          count={enabledGates.length}
          runStatus={runStatus}
          variant="active"
        />
      )}

      {disabledGates.length > 0 && (
        <GatesList
          title="Disabled Gates"
          gates={disabledGates}
          count={disabledGates.length}
          runStatus={runStatus}
          variant="disabled"
        />
      )}

      {config.config.qaGates.length === 0 && <EmptyState />}
    </div>
  );
}
