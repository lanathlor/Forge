'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Plus, X, Terminal } from 'lucide-react';
import type { QAGate } from '../types/qa-gates';

interface AddGateFormProps {
  onAdd: (gate: QAGate) => void;
  onCancel: () => void;
  nextOrder: number;
}

const TIMEOUT_OPTIONS = [
  { value: '30000', label: '30s' },
  { value: '60000', label: '1 min' },
  { value: '120000', label: '2 min' },
  { value: '180000', label: '3 min' },
  { value: '300000', label: '5 min' },
  { value: '600000', label: '10 min' },
];

export function AddGateForm({ onAdd, onCancel, nextOrder }: AddGateFormProps) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [timeout, setTimeout] = useState('60000');
  const [failOnError, setFailOnError] = useState(true);

  const isValid = name.trim().length > 0 && command.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onAdd({
      name: name.trim(),
      command: command.trim(),
      timeout: parseInt(timeout),
      failOnError,
      enabled: true,
      order: nextOrder,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold">Add New Quality Gate</h4>
          <p className="text-xs text-muted-foreground">
            Configure a command to validate your code
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label
            htmlFor="gate-name"
            className="text-xs font-semibold uppercase tracking-wide"
          >
            Gate Name
          </Label>
          <Input
            id="gate-name"
            placeholder="e.g. ESLint, Tests, Build"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10"
            autoFocus
          />
          {name.trim().length === 0 && (
            <p className="text-xs text-muted-foreground">
              Give your gate a descriptive name
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="gate-timeout"
            className="text-xs font-semibold uppercase tracking-wide"
          >
            Timeout
          </Label>
          <Select value={timeout} onValueChange={setTimeout}>
            <SelectTrigger id="gate-timeout" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEOUT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Max execution time for this gate
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="gate-command"
          className="text-xs font-semibold uppercase tracking-wide"
        >
          Command
        </Label>
        <div className="relative">
          <Terminal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            id="gate-command"
            placeholder="e.g. pnpm test --run"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="h-10 pl-9 font-mono text-sm"
          />
        </div>
        {command.trim().length === 0 && (
          <p className="text-xs text-muted-foreground">
            Enter the shell command to execute this gate
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-background/50 p-4">
        <div className="flex items-center gap-3">
          <Switch
            id="gate-fail-on-error"
            checked={failOnError}
            onCheckedChange={setFailOnError}
          />
          <div>
            <Label
              htmlFor="gate-fail-on-error"
              className="cursor-pointer font-semibold"
            >
              {failOnError ? 'Required Gate' : 'Optional Gate'}
            </Label>
            <p className="text-xs text-muted-foreground">
              {failOnError
                ? 'Pipeline stops if this gate fails'
                : 'Pipeline continues even if this gate fails'}
            </p>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={!isValid} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Gate
        </Button>
      </div>
    </form>
  );
}
