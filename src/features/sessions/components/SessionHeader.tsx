'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  StopCircle,
  History,
  ChevronDown,
} from 'lucide-react';
import {
  useGetSessionSummaryQuery,
  useEndSessionMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,
} from '../store/sessionsApi';
import type { Session, SessionStatus } from '@/db/schema/sessions';

interface SessionHeaderProps {
  session: Session;
  repositoryName: string;
  onOpenHistory?: () => void;
  onOpenSummary?: () => void;
  onSessionEnded?: () => void;
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

function formatDuration(ms: number): string {
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

 
export function SessionHeader({
  session,
  repositoryName,
  onOpenHistory,
  onOpenSummary,
  onSessionEnded,
}: SessionHeaderProps) {
  const [showControls, setShowControls] = useState(false);

  const { data: summaryData } = useGetSessionSummaryQuery(session.id, {
    pollingInterval: 30000, // Refresh every 30 seconds
  });

  const [endSession, { isLoading: isEnding }] = useEndSessionMutation();
  const [pauseSession, { isLoading: isPausing }] = usePauseSessionMutation();
  const [resumeSession, { isLoading: isResuming }] = useResumeSessionMutation();

  const stats = summaryData?.stats;
  const statusInfo = statusConfig[session.status];
  const isActive = session.status === 'active';
  const isPaused = session.status === 'paused';
  const isActionable = isActive || isPaused;

  const handleEndSession = async () => {
    if (confirm('End this session? You can view it in session history later.')) {
      await endSession(session.id);
      onSessionEnded?.();
      onOpenSummary?.();
    }
  };

  const handlePauseSession = async () => {
    await pauseSession(session.id);
  };

  const handleResumeSession = async () => {
    await resumeSession(session.id);
  };

  return (
    <div className="bg-card border rounded-lg p-3 sm:p-4">
      {/* Main Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-sm sm:text-base truncate">
            {repositoryName}
          </h2>
          <Badge variant={statusInfo.variant} className="flex items-center gap-1">
            {statusInfo.icon}
            <span className="hidden sm:inline">{statusInfo.label}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Quick Stats */}
          {stats && (
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1" title="Duration">
                <Clock className="h-3 w-3" />
                {formatDuration(stats.duration)}
              </div>
              <div className="flex items-center gap-1" title="Tasks">
                <span className="font-medium text-foreground">{stats.totalTasks}</span>
                tasks
              </div>
              {stats.completedTasks > 0 && (
                <div className="flex items-center gap-1 text-green-600" title="Completed">
                  <CheckCircle2 className="h-3 w-3" />
                  {stats.completedTasks}
                </div>
              )}
            </div>
          )}

          {/* History Button */}
          {onOpenHistory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenHistory}
              className="hidden sm:flex"
            >
              <History className="h-4 w-4" />
              <span className="hidden lg:inline ml-1">History</span>
            </Button>
          )}

          {/* Session Controls Toggle (Mobile) */}
          {isActionable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowControls(!showControls)}
              className="sm:hidden"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showControls ? 'rotate-180' : ''}`}
              />
            </Button>
          )}

          {/* Desktop Session Controls */}
          {isActionable && (
            <div className="hidden sm:flex items-center gap-2">
              {isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePauseSession}
                  disabled={isPausing}
                >
                  <Pause className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Pause</span>
                </Button>
              )}
              {isPaused && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResumeSession}
                  disabled={isResuming}
                >
                  <Play className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Resume</span>
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleEndSession}
                disabled={isEnding}
              >
                <StopCircle className="h-4 w-4" />
                <span className="hidden lg:inline ml-1">End Session</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Session Info Row */}
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
        </span>
        {session.startBranch && (
          <span className="hidden sm:inline">
            Branch: <span className="font-mono">{session.startBranch}</span>
          </span>
        )}
        <span className="sm:hidden">
          ID: {session.id.slice(0, 8)}
        </span>
      </div>

      {/* Mobile Stats & Controls */}
      {showControls && isActionable && (
        <div className="mt-3 pt-3 border-t space-y-3 sm:hidden">
          {/* Mobile Stats */}
          {stats && (
            <div className="flex items-center justify-around text-xs">
              <div className="text-center">
                <div className="font-medium text-foreground">{stats.totalTasks}</div>
                <div className="text-muted-foreground">Tasks</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-green-600">{stats.completedTasks}</div>
                <div className="text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-foreground">{formatDuration(stats.duration)}</div>
                <div className="text-muted-foreground">Duration</div>
              </div>
            </div>
          )}

          {/* Mobile Controls */}
          <div className="flex gap-2">
            {onOpenHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenHistory}
                className="flex-1"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
            )}
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePauseSession}
                disabled={isPausing}
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResumeSession}
                disabled={isResuming}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndSession}
              disabled={isEnding}
              className="flex-1"
            >
              <StopCircle className="h-4 w-4 mr-1" />
              End
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
