'use client';

import { useRef } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Download, Upload } from 'lucide-react';
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
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (content.qaGates && Array.isArray(content.qaGates)) {
          onImport(content.qaGates);
        } else if (Array.isArray(content)) {
          onImport(content);
        }
      } catch {
        console.error('Failed to parse config file');
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
        <Download className="h-4 w-4" />
        Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        title="Import configuration from .forge.json"
        className="gap-1.5"
      >
        <Upload className="h-4 w-4" />
        Import
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
