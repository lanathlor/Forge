'use client';

import { AppLayout } from '../components/AppLayout';
import { RepositorySelector } from '@/features/repositories/components/RepositorySelector';
import { useRouter } from 'next/navigation';

export default function RepositoriesPage() {
  const router = useRouter();

  const handleSelectRepository = () => {
    // Navigate to dashboard with selected repo
    router.push('/dashboard');
  };

  return (
    <AppLayout>
      <div className="h-full p-4 lg:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="mb-2 text-2xl font-bold">Repositories</h1>
            <p className="text-muted-foreground">
              Select a repository to view its dashboard and manage tasks.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <RepositorySelector
              onSelect={handleSelectRepository}
              isCollapsed={false}
              onToggleCollapse={() => {}}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
