'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Pause,
  Play,
  Square,
  History,
  FileText,
  GitCommit,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  useGetSessionSummaryQuery,
  useEndSessionMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,
} from '../store/sessionsApi';
import type { Session, SessionStatus } from '@/db/schema/sessions';

interface SessionControlsBarProps {
  session: Session;
  repositoryName: string;
  onOpenHistory?: () => void;
  onSessionEnded?: () => void;
}

const statusConfig: Record<
  SessionStatus,
  { label: string; color: string; pulseColor: string }
> = {
  active: {
    label: 'Active',
    color: 'bg-green-500',
    pulseColor: 'bg-green-400',
  },
  paused: {
    label: 'Paused',
    color: 'bg-yellow-500',
    pulseColor: 'bg-yellow-400',
  },
  completed: {
    label: 'Completed',
    color: 'bg-gray-400',
    pulseColor: 'bg-gray-300',
  },
  abandoned: {
    label: 'Abandoned',
    color: 'bg-red-500',
    pulseColor: 'bg-red-400',
  },
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function useElapsedTime(startedAt: Date, isRunning: boolean) {
  const [elapsed, setElapsed] = useState(
    () => Date.now() - new Date(startedAt).getTime()
  );

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    setElapsed(Date.now() - startTime);

    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, isRunning]);

  return elapsed;
}

export function SessionControlsBar({
  session,
  repositoryName,
  onOpenHistory,
  onSessionEnded,
}: SessionControlsBarProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);

  const { data: summaryData } = useGetSessionSummaryQuery(session.id, {
    pollingInterval: 30000,
  });

  const [endSession, { isLoading: isEnding }] = useEndSessionMutation();
  const [pauseSession, { isLoading: isPausing }] = usePauseSessionMutation();
  const [resumeSession, { isLoading: isResuming }] = useResumeSessionMutation();

  const stats = summaryData?.stats;
  const statusInfo = statusConfig[session.status];
  const isActive = session.status === 'active';
  const isPaused = session.status === 'paused';
  const isActionable = isActive || isPaused;

  const elapsed = useElapsedTime(session.startedAt, isActive);

  const handleEndSession = useCallback(async () => {
    await endSession(session.id);
    setShowEndDialog(false);
    onSessionEnded?.();
  }, [endSession, session.id, onSessionEnded]);

  const handlePauseSession = useCallback(async () => {
    await pauseSession(session.id);
  }, [pauseSession, session.id]);

  const handleResumeSession = useCallback(async () => {
    await resumeSession(session.id);
  }, [resumeSession, session.id]);

  // Keyboard shortcut: Escape to dismiss end dialog
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && showEndDialog) {
        setShowEndDialog(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showEndDialog]);

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-lg border bg-card/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:gap-3">
        {/* Status Indicator */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex-shrink-0">
            <span
              className={`block h-2.5 w-2.5 rounded-full ${statusInfo.color}`}
            />
            {isActive && (
              <span
                className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${statusInfo.pulseColor} animate-ping opacity-75`}
              />
            )}
          </div>
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            {statusInfo.label}
          </span>
        </div>

        {/* Separator */}
        <div className="h-4 w-px flex-shrink-0 bg-border" />

        {/* Repo Name (truncated on small screens) */}
        <span className="min-w-0 max-w-[120px] truncate text-sm font-medium sm:max-w-[200px]">
          {repositoryName}
        </span>

        {/* Elapsed Time */}
        <div className="flex flex-shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatElapsed(elapsed)}</span>
        </div>

        {/* Quick Stats (desktop only) */}
        {stats && (
          <div className="hidden flex-shrink-0 items-center gap-3 text-xs text-muted-foreground md:flex">
            <div className="h-4 w-px bg-border" />
            <span>
              <span className="font-medium text-foreground">
                {stats.totalTasks}
              </span>{' '}
              tasks
            </span>
            {stats.completedTasks > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {stats.completedTasks}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {/* History Button */}
          {onOpenHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenHistory}
              className="h-7 w-7 p-0"
              title="Session History (Cmd+Shift+H)"
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Pause/Resume Toggle */}
          {isActionable && (
            <>
              {isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePauseSession}
                  disabled={isPausing}
                  className="h-7 w-7 p-0"
                  title="Pause Session"
                >
                  {isPausing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResumeSession}
                  disabled={isResuming}
                  className="h-7 w-7 p-0"
                  title="Resume Session"
                >
                  {isResuming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}

              {/* End Session Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEndDialog(true)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title="End Session"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* End Session Confirmation Dialog */}
      <EndSessionDialog
        open={showEndDialog}
        onOpenChange={setShowEndDialog}
        onConfirm={handleEndSession}
        isEnding={isEnding}
        stats={stats}
        repositoryName={repositoryName}
        elapsed={elapsed}
      />
    </>
  );
}

// --- End Session Confirmation Dialog ---

interface EndSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isEnding: boolean;
  stats?: {
    totalTasks: number;
    completedTasks: number;
    rejectedTasks: number;
    failedTasks: number;
    filesChanged: number;
    commits: number;
    duration: number;
  };
  repositoryName: string;
  elapsed: number;
}

function EndSessionDialog({
  open,
  onOpenChange,
  onConfirm,
  isEnding,
  stats,
  repositoryName,
  elapsed,
}: EndSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>End Session?</DialogTitle>
          <DialogDescription>
            This will end the current session for{' '}
            <span className="font-medium text-foreground">
              {repositoryName}
            </span>
            . You can view it later in session history.
          </DialogDescription>
        </DialogHeader>

        {/* Session Summary Preview */}
        <div className="space-y-3">
          {/* Duration */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatElapsed(elapsed)}</span>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-muted/50 p-2 text-center">
                <div className="mb-0.5 flex items-center justify-center">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-lg font-semibold">{stats.totalTasks}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">
                  Tasks
                </div>
              </div>
              <div className="rounded-md bg-green-50 p-2 text-center dark:bg-green-950/20">
                <div className="mb-0.5 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                </div>
                <div className="text-lg font-semibold text-green-600">
                  {stats.completedTasks}
                </div>
                <div className="text-[10px] leading-tight text-muted-foreground">
                  Completed
                </div>
              </div>
              <div className="rounded-md bg-muted/50 p-2 text-center">
                <div className="mb-0.5 flex items-center justify-center">
                  <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-lg font-semibold">{stats.commits}</div>
                <div className="text-[10px] leading-tight text-muted-foreground">
                  Commits
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {stats && (stats.rejectedTasks > 0 || stats.failedTasks > 0) && (
            <div className="space-y-1.5">
              {stats.rejectedTasks > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-yellow-50 px-2.5 py-1.5 text-xs dark:bg-yellow-950/20">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
                  <span>
                    <span className="font-medium text-yellow-600">
                      {stats.rejectedTasks}
                    </span>{' '}
                    task{stats.rejectedTasks > 1 ? 's' : ''} rejected
                  </span>
                </div>
              )}
              {stats.failedTasks > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs dark:bg-red-950/20">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
                  <span>
                    <span className="font-medium text-red-600">
                      {stats.failedTasks}
                    </span>{' '}
                    task{stats.failedTasks > 1 ? 's' : ''} failed
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isEnding}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isEnding}>
            {isEnding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ending...
              </>
            ) : (
              'End Session'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
