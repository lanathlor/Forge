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
import { useQAGatesData } from './useQAGatesData';
import { QARunControls } from './QARunControls';
import { DraggableGatesList } from './DraggableGatesList';
import { AddGateForm } from './AddGateForm';
import { GatePresets } from './GatePresets';
import { ImportExportConfig } from './ImportExportConfig';
import { Plus, Save, Shield } from 'lucide-react';
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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">QA Gates</CardTitle>
              <CardDescription className="text-sm">
                {repositoryName} &middot; v{version}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Stats pills */}
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                <span className="font-bold text-green-600">{enabledCount}</span>
                <span className="text-muted-foreground">enabled</span>
              </Badge>
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <span className="font-bold">{totalCount - enabledCount}</span>
                <span className="text-muted-foreground">disabled</span>
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
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
              size="sm"
              className="gap-1.5"
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
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Pipeline Configuration
      </h3>
      <div className="flex items-center gap-2">
        <ImportExportConfig
          gates={gates}
          version={version}
          maxRetries={maxRetries}
          onImport={onImport}
        />
        <GatePresets onApplyPreset={onApplyPreset} />
        <Button
          variant={showAddForm ? 'secondary' : 'outline'}
          size="sm"
          onClick={onAddClick}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Gate
        </Button>
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
