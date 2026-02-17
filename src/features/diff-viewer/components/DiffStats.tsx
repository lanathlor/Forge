'use client';

import { Plus, Minus, FileText } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { DiffStats as DiffStatsType } from '@/lib/git/diff';

interface DiffStatsProps {
  stats: DiffStatsType;
  className?: string;
}

export function DiffStats({ stats, className }: DiffStatsProps) {
  const total = stats.insertions + stats.deletions;
  const addPct = total > 0 ? (stats.insertions / total) * 100 : 50;

  return (
    <div className={cn('flex items-center gap-3 px-3 py-2 text-xs', className)}>
      <span className="flex items-center gap-1 text-text-secondary">
        <FileText className="h-3 w-3" />
        <span className="font-medium">{stats.filesChanged}</span>
        <span className="hidden text-text-muted sm:inline">
          {stats.filesChanged === 1 ? 'file' : 'files'}
        </span>
      </span>

      <span className="flex items-center gap-0.5 font-mono tabular-nums text-emerald-500">
        <Plus className="h-3 w-3" />
        {stats.insertions}
      </span>

      <span className="flex items-center gap-0.5 font-mono tabular-nums text-red-400">
        <Minus className="h-3 w-3" />
        {stats.deletions}
      </span>

      {/* Mini change bar */}
      {total > 0 && (
        <div className="ml-auto hidden items-center gap-1 sm:flex">
          <div className="flex h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-l-full bg-emerald-500"
              style={{ width: `${addPct}%` }}
            />
            <div
              className="h-full rounded-r-full bg-red-400"
              style={{ width: `${100 - addPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
