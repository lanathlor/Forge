'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useQAGatesData } from './useQAGatesData';
import { QARunControls } from './QARunControls';
import { DraggableGatesList } from './DraggableGatesList';
import { AddGateForm } from './AddGateForm';
import { GatePresets } from './GatePresets';
import { ImportExportConfig } from './ImportExportConfig';
import { Plus, Save, Shield, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
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

function StatusAlert({
  runStatus,
  hasChanges,
}: {
  runStatus: QARunStatusData | null;
  hasChanges: boolean;
}) {
  if (!runStatus?.hasRun) {
    return (
      <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-200">
          Configure your QA gates below, then run them to validate your code quality.
        </AlertDescription>
      </Alert>
    );
  }

  if (hasChanges) {
    return (
      <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-sm text-amber-900 dark:text-amber-200">
          You have unsaved changes. Save your configuration before running QA gates.
        </AlertDescription>
      </Alert>
    );
  }

  if (runStatus.run?.status === 'passed') {
    return (
      <Alert className="border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/20">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-sm text-green-900 dark:text-green-200">
          All QA gates passed! Your code meets quality standards.
        </AlertDescription>
      </Alert>
    );
  }

  if (runStatus.run?.status === 'failed') {
    const failedGates = runStatus.gates.filter((g) => g.status === 'failed');
    return (
      <Alert className="border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <AlertDescription className="text-sm text-red-900 dark:text-red-200">
          {failedGates.length} gate{failedGates.length > 1 ? 's' : ''} failed. Review the
          output below to fix issues.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function PipelineHeader({
  repositoryName,
  version,
  enabledCount,
  totalCount,
  runStatus,
  isRunning,
  isSaving,
  hasChanges,
  onRun,
  onSave,
}: {
  repositoryName: string;
  version: string;
  enabledCount: number;
  totalCount: number;
  runStatus: QARunStatusData | null;
  isRunning: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  onRun: () => void;
  onSave: () => void;
}) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">QA Gates Configuration</CardTitle>
              <CardDescription className="text-sm">
                {repositoryName} &middot; v{version}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats pills */}
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                <span className="font-bold text-green-600 dark:text-green-400">{enabledCount}</span>
                <span className="text-muted-foreground">active</span>
              </Badge>
              {totalCount - enabledCount > 0 && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                  <span className="font-bold">{totalCount - enabledCount}</span>
                  <span className="text-muted-foreground">disabled</span>
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
                <span className="font-bold">{totalCount}</span>
                <span className="text-muted-foreground">total</span>
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-6 pt-0">
        <StatusAlert runStatus={runStatus} hasChanges={hasChanges} />

        <div className="flex items-center justify-between">
          <QARunControls
            status={runStatus?.run?.status || null}
            hasRun={runStatus?.hasRun || false}
            isRunning={isRunning}
            enabledGatesCount={enabledCount}
            onRun={onRun}
          />
          {hasChanges && (
            <Button
              onClick={onSave}
              disabled={isSaving}
              size="lg"
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigToolbar({
  gates,
  version,
  maxRetries,
  onAddClick,
  showAddForm,
  onApplyPreset,
  onImport,
}: {
  gates: QAGate[];
  version: string;
  maxRetries: number;
  onAddClick: () => void;
  showAddForm: boolean;
  onApplyPreset: (gates: QAGate[]) => void;
  onImport: (gates: QAGate[]) => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Gates Pipeline</h3>
            <p className="text-sm text-muted-foreground">
              Configure, reorder, and test your quality gates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ImportExportConfig
              gates={gates}
              version={version}
              maxRetries={maxRetries}
              onImport={onImport}
            />
            <GatePresets onApplyPreset={onApplyPreset} />
            <Button
              variant={showAddForm ? 'secondary' : 'default'}
              size="sm"
              onClick={onAddClick}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? 'Cancel' : 'Add Gate'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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

  const enabledCount = useMemo(() => gates.filter(g => g.enabled).length, [gates]);

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

  return (
    <div className="space-y-4">
      <PipelineHeader
        repositoryName={config.repository.name}
        version={config.config.version}
        enabledCount={enabledCount}
        totalCount={gates.length}
        runStatus={runStatus}
        isRunning={isRunning}
        isSaving={isSaving}
        hasChanges={hasChanges}
        onRun={runQAGates}
        onSave={handleSave}
      />

      <ConfigToolbar
        gates={gates}
        version={config.config.version}
        maxRetries={config.config.maxRetries}
        onAddClick={() => setShowAddForm(!showAddForm)}
        showAddForm={showAddForm}
        onApplyPreset={handleApplyPreset}
        onImport={handleImport}
      />

      {showAddForm && (
        <AddGateForm
          onAdd={handleAddGate}
          onCancel={() => setShowAddForm(false)}
          nextOrder={gates.length + 1}
        />
      )}

      <DraggableGatesList
        gates={gates}
        repositoryId={repositoryId}
        runStatus={runStatus}
        onReorder={reorderGates}
        onToggle={toggleGate}
        onDelete={deleteGate}
      />
    </div>
  );
}
