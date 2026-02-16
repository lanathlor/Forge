'use client';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { PackagePlus } from 'lucide-react';
import { useState } from 'react';
import type { QAGate } from '../types/qa-gates';

interface GatePresetsProps {
  onApplyPreset: (gates: QAGate[]) => void;
}

interface PresetInfo {
  key: string;
  label: string;
  description: string;
  gates: QAGate[];
}

const PRESETS: PresetInfo[] = [
  {
    key: 'typescript',
    label: 'TypeScript',
    description: 'ESLint + TypeScript + Tests + Build',
    gates: [
      { name: 'ESLint', enabled: true, command: 'pnpm eslint . --ext .ts,.tsx', timeout: 60000, failOnError: true, order: 1 },
      { name: 'TypeScript', enabled: true, command: 'pnpm tsc --noEmit', timeout: 120000, failOnError: true, order: 2 },
      { name: 'Tests', enabled: true, command: 'pnpm test --run', timeout: 300000, failOnError: false, order: 3 },
      { name: 'Build', enabled: false, command: 'pnpm build', timeout: 180000, failOnError: true, order: 4 },
    ],
  },
  {
    key: 'javascript',
    label: 'JavaScript',
    description: 'ESLint + Tests',
    gates: [
      { name: 'ESLint', enabled: true, command: 'npm run lint', timeout: 60000, failOnError: true, order: 1 },
      { name: 'Tests', enabled: true, command: 'npm test', timeout: 300000, failOnError: true, order: 2 },
    ],
  },
  {
    key: 'python',
    label: 'Python',
    description: 'Ruff + MyPy + Pytest',
    gates: [
      { name: 'Ruff', enabled: true, command: 'ruff check .', timeout: 60000, failOnError: true, order: 1 },
      { name: 'MyPy', enabled: true, command: 'mypy .', timeout: 120000, failOnError: true, order: 2 },
      { name: 'Pytest', enabled: true, command: 'pytest', timeout: 300000, failOnError: false, order: 3 },
    ],
  },
  {
    key: 'go',
    label: 'Go',
    description: 'Fmt + Vet + Test',
    gates: [
      { name: 'Go Fmt', enabled: true, command: 'go fmt ./...', timeout: 30000, failOnError: true, order: 1 },
      { name: 'Go Vet', enabled: true, command: 'go vet ./...', timeout: 60000, failOnError: true, order: 2 },
      { name: 'Go Test', enabled: true, command: 'go test ./...', timeout: 300000, failOnError: true, order: 3 },
    ],
  },
  {
    key: 'rust',
    label: 'Rust',
    description: 'Clippy + Fmt + Test',
    gates: [
      { name: 'Clippy', enabled: true, command: 'cargo clippy -- -D warnings', timeout: 120000, failOnError: true, order: 1 },
      { name: 'Rust Format', enabled: true, command: 'cargo fmt --check', timeout: 30000, failOnError: true, order: 2 },
      { name: 'Cargo Test', enabled: true, command: 'cargo test', timeout: 300000, failOnError: true, order: 3 },
    ],
  },
];

export function GatePresets({ onApplyPreset }: GatePresetsProps) {
  const [open, setOpen] = useState(false);

  function handleSelect(preset: PresetInfo) {
    onApplyPreset(preset.gates);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PackagePlus className="mr-1.5 h-4 w-4" />
          Presets
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Load Preset Configuration</DialogTitle>
          <DialogDescription>
            Quick-start with pre-configured quality gates for your tech stack. This will replace your current configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 pt-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              className="group flex w-full items-center justify-between rounded-xl border-2 border-muted p-5 text-left transition-all hover:border-primary/50 hover:bg-accent hover:shadow-md"
              onClick={() => handleSelect(preset)}
            >
              <div className="flex-1">
                <div className="mb-1 text-lg font-semibold">{preset.label}</div>
                <div className="text-sm text-muted-foreground">{preset.description}</div>
              </div>
              <div className="ml-4 flex flex-col items-end gap-2">
                <Badge variant="secondary" className="px-3 py-1">
                  {preset.gates.length} gates
                </Badge>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  Click to load
                </span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
