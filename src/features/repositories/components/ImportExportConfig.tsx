'use client';

import { useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Download, Upload, Check, AlertTriangle } from 'lucide-react';
import type { QAGate } from '../types/qa-gates';

interface ImportExportConfigProps {
  gates: QAGate[];
  version: string;
  maxRetries: number;
  onImport: (gates: QAGate[]) => void;
}

export function ImportExportConfig({
  gates,
  version,
  maxRetries,
  onImport,
}: ImportExportConfigProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportDone, setExportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const config = {
      version,
      maxRetries,
      qaGates: gates,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.forge.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2000);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (content.qaGates && Array.isArray(content.qaGates)) {
          onImport(content.qaGates);
        } else if (Array.isArray(content)) {
          onImport(content);
        } else {
          setImportError('Invalid config format');
          setTimeout(() => setImportError(null), 3000);
        }
      } catch {
        setImportError('Failed to parse file');
        setTimeout(() => setImportError(null), 3000);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        title="Export configuration as .forge.json"
        className="gap-1.5"
      >
        {exportDone ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline">Exported</span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        title="Import configuration from .forge.json"
        className="gap-1.5"
      >
        {importError ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="hidden sm:inline text-amber-600">{importError}</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.forge.json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}
