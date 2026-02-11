'use client';

import { ConnectionStatusIndicator } from '@/shared/components/ConnectionStatusIndicator';

export function PageHeader() {
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Claude Code Oversight
            </p>
          </div>
          <ConnectionStatusIndicator showDetails compact={false} />
        </div>
      </div>
    </div>
  );
}
