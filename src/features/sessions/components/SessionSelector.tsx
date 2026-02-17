'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  ChevronDown,
  Check,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  useListSessionsQuery,
  useResumeSessionMutation,
} from '../store/sessionsApi';
import type { Session, SessionStatus } from '@/db/schema/sessions';

interface SessionSelectorProps {
  currentSession: Session;
  repositoryId: string;
  onSelectSession: (sessionId: string) => void;
  onCreateNewSession?: () => void;
}

const statusIcons: Record<SessionStatus, React.ReactNode> = {
  active: <Play className="h-3 w-3 text-green-600" />,
  paused: <Pause className="h-3 w-3 text-yellow-600" />,
  completed: <CheckCircle2 className="h-3 w-3 text-muted-foreground" />,
  abandoned: <XCircle className="h-3 w-3 text-red-600" />,
};

export function SessionSelector({
  currentSession,
  repositoryId,
  onSelectSession,
  onCreateNewSession,
}: SessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading } = useListSessionsQuery(
    { repositoryId, limit: 10 },
    { skip: !isOpen }
  );

  const [resumeSession] = useResumeSessionMutation();

  const sessions = data?.sessions ?? [];
  const otherSessions = sessions.filter((s) => s.id !== currentSession.id);

  const handleSelect = async (session: Session) => {
    // If selecting a paused session, resume it
    if (session.status === 'paused') {
      await resumeSession(session.id);
    }
    onSelectSession(session.id);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        {statusIcons[currentSession.status]}
        <span className="hidden max-w-[120px] truncate sm:inline">
          {currentSession.id.slice(0, 8)}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {/* Current Session */}
            <div className="border-b bg-muted/50 p-3">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                Current Session
              </div>
              <div className="flex items-center gap-2">
                {statusIcons[currentSession.status]}
                <span className="font-mono text-sm">
                  {currentSession.id.slice(0, 8)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {currentSession.status}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Started{' '}
                {formatDistanceToNow(new Date(currentSession.startedAt), {
                  addSuffix: true,
                })}
              </div>
            </div>

            {/* Recent Sessions */}
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : otherSessions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No other sessions
                </div>
              ) : (
                <div className="py-1">
                  <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                    Recent Sessions
                  </div>
                  {otherSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleSelect(session)}
                      className="group flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          {statusIcons[session.status]}
                          <span className="font-mono text-sm">
                            {session.id.slice(0, 8)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {session.taskCount} tasks
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(session.startedAt), {
                            addSuffix: true,
                          })}
                          {session.status === 'paused' && (
                            <span className="ml-2 text-yellow-600">
                              (paused)
                            </span>
                          )}
                        </div>
                      </div>
                      {session.id === currentSession.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New Session Button */}
            {onCreateNewSession && (
              <div className="border-t p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onCreateNewSession();
                    setIsOpen(false);
                  }}
                  className="w-full"
                >
                  Start New Session
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
