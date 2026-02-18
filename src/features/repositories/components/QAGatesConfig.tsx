'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useQAGatesData } from './useQAGatesData';
import { QARunControls } from './QARunControls';
import { DraggableGatesList } from './DraggableGatesList';
import { AddGateForm } from './AddGateForm';
import { GatePresets } from './GatePresets';
import { ImportExportConfig } from './ImportExportConfig';
import {
  Plus,
  Save,
  Shield,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import type {
  QAGatesConfigProps,
  QAGate,
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
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-center gap-3">
        <ShieldX className="h-5 w-5 text-destructive" />
        <div>
          <h3 className="font-semibold text-destructive">
            Error Loading Configuration
          </h3>
          <p className="mt-1 text-sm text-destructive/80">{error}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAddClick, onApplyPreset }: {
  onAddClick: () => void;
  onApplyPreset: (gates: QAGate[]) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 py-16 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
        <Shield className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">No QA gates configured</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        QA gates run automated checks on your code. Add gates to enforce linting,
        type checking, tests, and more.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onAddClick} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add First Gate
        </Button>
        <GatePresets onApplyPreset={onApplyPreset} />
      </div>
    </div>
  );
}

export function QAGatesConfig({ repositoryId }: QAGatesConfigProps) {
  const {
    config,
    gates,
    isLoading,
    isSaving,
    error,
    runStatus,
    isRunning,
    runQAGates,
    updateGates,
    saveConfig,
    toggleGate,
    deleteGate,
    addGate,
    reorderGates,
  } = useQAGatesData(repositoryId);

  const [showAddForm, setShowAddForm] = useState(false);

  const hasChanges = useMemo(() => {
    if (!config) return false;
    return JSON.stringify(config.config.qaGates) !== JSON.stringify(gates);
  }, [config, gates]);

  const enabledCount = useMemo(
    () => gates.filter((g) => g.enabled).length,
    [gates]
  );
  const requiredCount = useMemo(() => gates.filter(g => g.enabled && g.failOnError).length, [gates]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!config) return null;

  function handleAddGate(gate: QAGate) {
    addGate(gate);
    setShowAddForm(false);
  }

  function handleApplyPreset(presetGates: QAGate[]) {
    updateGates(presetGates);
  }

  function handleImport(importedGates: QAGate[]) {
    updateGates(importedGates.map((g, i) => ({ ...g, order: i + 1 })));
  }

  async function handleSave() {
    try {
      await saveConfig();
    } catch {
      // Error is logged in the hook
    }
  }

  const lastRunStatus = runStatus?.run?.status;
  const statusIcon = lastRunStatus === 'passed'
    ? <ShieldCheck className="h-5 w-5 text-green-600" />
    : lastRunStatus === 'failed'
      ? <ShieldX className="h-5 w-5 text-red-500" />
      : <Shield className="h-5 w-5 text-primary" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            {statusIcon}
          </div>
          <div>
            <h2 className="text-xl font-bold">QA Gates</h2>
            <p className="text-sm text-muted-foreground">
              {config.repository.name}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <span className="font-bold text-green-600">{enabledCount}</span>
            <span className="text-muted-foreground">active</span>
          </Badge>
          {requiredCount > 0 && (
            <Badge variant="outline" className="gap-1.5 px-3 py-1">
              <span className="font-bold">{requiredCount}</span>
              <span className="text-muted-foreground">required</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Run controls + save */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <QARunControls
          status={lastRunStatus || null}
          hasRun={runStatus?.hasRun || false}
          isRunning={isRunning}
          enabledGatesCount={enabledCount}
          onRun={runQAGates}
        />
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="gap-1.5 self-start sm:self-auto"
          >
            {isSaving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* Toolbar */}
      {gates.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <ImportExportConfig
              gates={gates}
              version={config.config.version}
              maxRetries={config.config.maxRetries}
              onImport={handleImport}
            />
            <GatePresets onApplyPreset={handleApplyPreset} />
            <Button
              variant={showAddForm ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add Gate
            </Button>
          </div>
        </div>
      )}

      {/* Add Gate Form */}
      {showAddForm && (
        <AddGateForm
          onAdd={handleAddGate}
          onCancel={() => setShowAddForm(false)}
          nextOrder={gates.length + 1}
        />
      )}

      {/* Gate List or Empty State */}
      {gates.length === 0 && !showAddForm ? (
        <EmptyState
          onAddClick={() => setShowAddForm(true)}
          onApplyPreset={handleApplyPreset}
        />
      ) : (
        <DraggableGatesList
          gates={gates}
          repositoryId={repositoryId}
          runStatus={runStatus}
          onReorder={reorderGates}
          onToggle={toggleGate}
          onDelete={deleteGate}
        />
      )}
    </div>
  );
}
