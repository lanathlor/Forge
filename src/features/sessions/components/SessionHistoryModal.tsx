'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  GitCommit,
  Play,
  Pause,
  Trash2,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import {
  useListSessionsQuery,
  useDeleteSessionMutation,
  useResumeSessionMutation,
} from '../store/sessionsApi';
import type { SessionStatus } from '@/db/schema/sessions';

interface SessionHistoryModalProps {
  repositoryId: string;
  repositoryName: string;
  currentSessionId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

const statusConfig: Record<
  SessionStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
  active: {
    label: 'Active',
    variant: 'default',
    icon: <Play className="h-3 w-3" />,
  },
  paused: {
    label: 'Paused',
    variant: 'secondary',
    icon: <Pause className="h-3 w-3" />,
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  abandoned: {
    label: 'Abandoned',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
  },
};

function formatDuration(start: Date, end: Date | null): string {
  const endTime = end ?? new Date();
  const ms = endTime.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/* eslint-disable max-lines-per-function, complexity */
export function SessionHistoryModal({
  repositoryId,
  repositoryName,
  currentSessionId,
  isOpen,
  onClose,
  onSelectSession,
}: SessionHistoryModalProps) {
  const { data, isLoading, refetch } = useListSessionsQuery(
    { repositoryId, limit: 20 },
    { skip: !isOpen }
  );

  const [deleteSession, { isLoading: isDeleting }] = useDeleteSessionMutation();
  const [resumeSession] = useResumeSessionMutation();

  const sessions = data?.sessions ?? [];

  const handleSelectSession = async (sessionId: string, status: SessionStatus) => {
    // If selecting a paused session, resume it
    if (status === 'paused') {
      await resumeSession(sessionId);
    }
    onSelectSession(sessionId);
    onClose();
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this session and all its tasks? This cannot be undone.')) {
      await deleteSession(sessionId);
      refetch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Session History</DialogTitle>
          <DialogDescription>
            Sessions for {repositoryName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sessions yet</p>
              <p className="text-sm mt-1">
                Sessions will appear here as you work
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const statusInfo = statusConfig[session.status];
                const isCurrent = session.id === currentSessionId;
                const isActionable = session.status === 'active' || session.status === 'paused';

                return (
                  <div
                    key={session.id}
                    className={`
                      group relative border rounded-lg p-4 transition-colors
                      ${isCurrent ? 'border-primary bg-primary/5' : 'hover:bg-accent'}
                      ${isActionable ? 'cursor-pointer' : ''}
                    `}
                    onClick={
                      isActionable
                        ? () => handleSelectSession(session.id, session.status)
                        : undefined
                    }
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={statusInfo.variant}
                          className="flex items-center gap-1"
                        >
                          {statusInfo.icon}
                          {statusInfo.label}
                        </Badge>
                        <span className="font-mono text-sm text-muted-foreground">
                          {session.id.slice(0, 8)}
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isCurrent && session.status !== 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            disabled={isDeleting}
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {isActionable && !isCurrent && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Time Info */}
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(session.startedAt), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div>
                        Duration:{' '}
                        {formatDuration(
                          new Date(session.startedAt),
                          session.endedAt ? new Date(session.endedAt) : null
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{session.taskCount}</span>
                        <span className="text-muted-foreground">tasks</span>
                      </div>
                      {session.startBranch && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GitCommit className="h-3 w-3" />
                          <span className="font-mono">{session.startBranch}</span>
                        </div>
                      )}
                    </div>

                    {/* Relative Time */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.startedAt), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t -mx-6 px-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
