'use client';

import type { DiffStats as DiffStatsType } from '@/lib/git/diff';

interface DiffStatsProps {
  stats: DiffStatsType;
}

export function DiffStats({ stats }: DiffStatsProps) {
  return (
    <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
      <div className="flex items-center gap-4 text-sm">
        <h3 className="font-semibold text-gray-700">Changes Summary</h3>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">
            {stats.filesChanged} {stats.filesChanged === 1 ? 'file' : 'files'} changed
          </span>
          <span className="text-green-600 font-medium">
            +{stats.insertions} insertions
          </span>
          <span className="text-red-600 font-medium">
            -{stats.deletions} deletions
          </span>
        </div>
      </div>
    </div>
  );
}
