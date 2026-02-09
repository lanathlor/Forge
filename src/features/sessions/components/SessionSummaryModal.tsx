'use client';

import { format } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  GitCommit,
  AlertTriangle,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { useGetSessionSummaryQuery } from '../store/sessionsApi';

interface SessionSummaryModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onNewSession?: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/* eslint-disable max-lines-per-function, complexity */
export function SessionSummaryModal({
  sessionId,
  isOpen,
  onClose,
  onNewSession,
}: SessionSummaryModalProps) {
  const { data, isLoading } = useGetSessionSummaryQuery(sessionId, {
    skip: !isOpen,
  });

  const summary = data;
  const session = summary?.session;
  const stats = summary?.stats;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Session Summary</DialogTitle>
          {session && (
            <DialogDescription>
              Session completed for {session.repository.name}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !summary ? (
          <div className="text-center py-8 text-muted-foreground">
            Session not found
          </div>
        ) : (
          <div className="space-y-6">
            {/* Session Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Repository</span>
                <span className="font-medium">{session!.repository.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{formatDuration(stats!.duration)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Started</span>
                <span className="font-medium">
                  {format(new Date(session!.startedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {session!.endedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ended</span>
                  <span className="font-medium">
                    {format(new Date(session!.endedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              )}
            </div>

            {/* Branch Info */}
            {(session!.startBranch || session!.endBranch) && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-3">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  {session!.startBranch && (
                    <div>
                      <span className="text-muted-foreground">Start: </span>
                      <span className="font-mono">{session!.startBranch}</span>
                    </div>
                  )}
                  {session!.endBranch && session!.endBranch !== session!.startBranch && (
                    <div>
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-mono">{session!.endBranch}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{stats!.totalTasks}</div>
                <div className="text-xs text-muted-foreground">Total Tasks</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{stats!.filesChanged}</div>
                <div className="text-xs text-muted-foreground">Files Changed</div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {stats!.completedTasks}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <GitCommit className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{stats!.commits}</div>
                <div className="text-xs text-muted-foreground">Commits</div>
              </div>
            </div>

            {/* Warnings */}
            {(stats!.rejectedTasks > 0 || stats!.failedTasks > 0) && (
              <div className="space-y-2">
                {stats!.rejectedTasks > 0 && (
                  <div className="flex items-center gap-2 text-sm bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3">
                    <XCircle className="h-4 w-4 text-yellow-600" />
                    <span>
                      <span className="font-medium text-yellow-600">
                        {stats!.rejectedTasks}
                      </span>{' '}
                      task{stats!.rejectedTasks > 1 ? 's' : ''} rejected
                    </span>
                  </div>
                )}
                {stats!.failedTasks > 0 && (
                  <div className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span>
                      <span className="font-medium text-red-600">
                        {stats!.failedTasks}
                      </span>{' '}
                      task{stats!.failedTasks > 1 ? 's' : ''} failed
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onNewSession && (
            <Button
              variant="default"
              onClick={() => {
                onNewSession();
                onClose();
              }}
              className="w-full sm:w-auto"
            >
              Start New Session
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
