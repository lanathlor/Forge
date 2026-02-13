'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { GripVertical, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { TestGateButton } from './TestGateButton';
import type {
  QAGate,
  QAGateExecutionResult,
} from '../types/qa-gates';

interface QAGateCardProps {
  gate: QAGate;
  index: number;
  execution?: QAGateExecutionResult;
  repositoryId: string;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete: (name: string) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

function ExecutionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    running: {
      label: 'Running',
      className: 'h-6 border border-blue-500/30 bg-blue-500/15 px-3 text-xs font-semibold text-blue-700 dark:text-blue-400',
    },
    passed: {
      label: 'Passed',
      className: 'h-6 border border-green-500/30 bg-green-500/15 px-3 text-xs font-semibold text-green-700 dark:text-green-400',
    },
    failed: {
      label: 'Failed',
      className: 'h-6 border border-red-500/30 bg-red-500/15 px-3 text-xs font-semibold text-red-700 dark:text-red-400',
    },
    skipped: {
      label: 'Skipped',
      className: 'h-6 px-3 text-xs font-semibold',
    },
  };

  const info = config[status];
  if (!info) return null;

  return (
    <Badge variant={status === 'skipped' ? 'outline' : undefined} className={info.className}>
      {info.label}
    </Badge>
  );
}

function OutputSection({ output, label, isError = false }: { output: string; label: string; isError?: boolean }) {
  return (
    <div>
      <div className={`mb-2 text-xs font-semibold ${isError ? 'text-red-600' : 'text-muted-foreground'}`}>
        {label}
      </div>
      <div
        className={`max-h-48 overflow-auto rounded-lg border px-4 py-3 font-mono text-xs ${
          isError
            ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20'
            : 'bg-muted/50'
        }`}
      >
        <pre
          className={`whitespace-pre-wrap break-words ${
            isError ? 'text-red-900 dark:text-red-400' : 'text-muted-foreground'
          }`}
        >
          {output}
        </pre>
      </div>
    </div>
  );
}

export function QAGateCard({
  gate,
  index,
  execution,
  repositoryId,
  onToggle,
  onDelete,
  dragHandleProps,
  isDragging = false,
}: QAGateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOutput = execution && (execution.output || execution.error);

  return (
    <Card
      className={`transition-all ${
        isDragging ? 'rotate-1 scale-[1.02] shadow-xl ring-2 ring-primary/20' : ''
      } ${
        gate.enabled
          ? 'border-l-4 border-l-primary hover:shadow-md'
          : 'border-dashed opacity-60 hover:opacity-80'
      }`}
    >
      <CardHeader className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            className="flex cursor-grab items-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Order number */}
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              gate.enabled
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {gate.order ?? index + 1}
          </div>

          {/* Name & command */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{gate.name}</CardTitle>
              {gate.failOnError ? (
                <Badge className="h-5 border border-primary/50 bg-primary/15 px-2 text-[10px] font-bold text-primary">
                  Required
                </Badge>
              ) : (
                <Badge variant="outline" className="h-5 px-2 text-[10px]">
                  Optional
                </Badge>
              )}
            </div>
            <code className="text-xs text-muted-foreground">{gate.command}</code>
          </div>

          {/* Execution status badges */}
          {execution && (
            <div className="flex items-center gap-2">
              <ExecutionStatusBadge status={execution.status} />
              {execution.duration != null && (
                <span className="text-xs text-muted-foreground">
                  {(execution.duration / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          )}

          {/* Timeout */}
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {(gate.timeout / 1000).toFixed(0)}s
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <TestGateButton
              repositoryId={repositoryId}
              gateName={gate.name}
              command={gate.command}
            />
            <Switch
              checked={gate.enabled}
              onCheckedChange={(enabled) => onToggle(gate.name, enabled)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(gate.name)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable output */}
      {hasOutput && (
        <CardContent className="px-4 pb-3 pt-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-1.5 rounded-md bg-muted/30 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? 'Hide output' : 'Show output'}
          </button>

          {expanded && execution && (
            <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1">
              {execution.output && (
                <OutputSection output={execution.output} label="Output:" />
              )}
              {execution.error && (
                <OutputSection output={execution.error} label="Error:" isError />
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
