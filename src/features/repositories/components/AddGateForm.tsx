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
import { Plus, X } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Add New Gate</h4>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gate-name">Name</Label>
          <Input
            id="gate-name"
            placeholder="e.g. ESLint, Tests, Build"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gate-timeout">Timeout</Label>
          <Select value={timeout} onValueChange={setTimeout}>
            <SelectTrigger id="gate-timeout">
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
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gate-command">Command</Label>
        <Input
          id="gate-command"
          placeholder="e.g. pnpm test --run"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="font-mono"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch checked={failOnError} onCheckedChange={setFailOnError} />
          <Label className="cursor-pointer text-sm">
            {failOnError ? 'Required' : 'Optional'}
            <span className="ml-2 text-xs text-muted-foreground">
              {failOnError ? '(blocks pipeline on failure)' : '(pipeline continues on failure)'}
            </span>
          </Label>
        </div>

        <Button type="submit" size="sm" disabled={!isValid}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Gate
        </Button>
      </div>
    </form>
  );
}
