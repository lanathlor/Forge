'use client';

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  return (
    <AppLayout activeNavItem="tasks">
      <div className="h-full p-4 lg:p-6">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Button>
        </div>
        <div className="flex items-center justify-center h-[calc(100%-4rem)]">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Task Detail</h1>
            <p className="text-muted-foreground">Task ID: {taskId}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Task detail view coming soon. Use the dashboard view to interact with tasks.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
