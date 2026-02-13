'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { StatCard, Skeleton } from '@/shared/components/ui/dashboard-cards';
import { RepositoryStatusBadge } from './RepositoryStatusBadge';
import { QAGatesConfig } from '@/features/repositories/components/QAGatesConfig';
import { useListSessionsQuery } from '@/features/sessions/store/sessionsApi';
import type { Repository } from '@/db/schema';
import type { SessionWithStats } from '@/features/sessions/store/sessionsApi';
import {
  GitBranch,
  FolderOpen,
  PlayCircle,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  BarChart3,
  Shield,
  ArrowLeft,
  ListTodo,
  PauseCircle,
  FileText,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface RepositoryDetailViewProps {
  repository: Repository;
  onBack?: () => void;
  onStartSession?: () => void;
  onSelectSession?: (sessionId: string) => void;
  className?: string;
}

/* ============================================
   REPOSITORY HEADER
   ============================================ */

interface RepoHeaderProps {
  repository: Repository;
  onBack?: () => void;
  onStartSession?: () => void;
}

function RepoHeader({ repository, onBack, onStartSession }: RepoHeaderProps) {
  return (
    <div className="rounded-xl border-2 bg-gradient-to-br from-card to-card/50 p-5 sm:p-6 shadow-sm">
      {/* Top row: back + actions */}
      <div className="flex items-center justify-between mb-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <RepositoryStatusBadge isClean={repository.isClean} />
        </div>
      </div>

      {/* Repo name + path */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{repository.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground font-mono truncate">{repository.path}</p>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <InfoChip icon={GitBranch} label="Branch" value={repository.currentBranch ?? 'unknown'} mono />
        {repository.lastCommitSha && (
          <InfoChip
            icon={FileText}
            label="Last commit"
            value={repository.lastCommitSha.slice(0, 7)}
            mono
          />
        )}
        {repository.lastScanned && (
          <InfoChip
            icon={Clock}
            label="Scanned"
            value={formatRelativeTime(new Date(repository.lastScanned))}
          />
        )}
      </div>

      {/* Last commit message */}
      {repository.lastCommitMsg && (
        <div className="mt-4 rounded-lg bg-muted/40 px-3 py-2 border border-border/50">
          <p className="text-xs text-muted-foreground mb-0.5">Last commit</p>
          <p className="text-sm text-text-primary line-clamp-2">{repository.lastCommitMsg}</p>
          {repository.lastCommitAuthor && (
            <p className="text-xs text-muted-foreground mt-1">by {repository.lastCommitAuthor}</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {onStartSession && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onStartSession} size="sm" className="gap-1.5">
            <PlayCircle className="h-4 w-4" />
            Start New Session
          </Button>
        </div>
      )}
    </div>
  );
}

/* ============================================
   INFO CHIP
   ============================================ */

interface InfoChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}

function InfoChip({ icon: Icon, label, value, mono }: InfoChipProps) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs">{label}:</span>
      <span
        className={cn(
          'text-xs font-medium text-text-primary px-1.5 py-0.5 rounded bg-muted/60 border border-border/50',
          mono && 'font-mono'
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ============================================
   SESSION STATISTICS
   ============================================ */

interface SessionStatsProps {
  sessions: SessionWithStats[];
  loading?: boolean;
}

function computeStats(sessions: SessionWithStats[]) {
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const totalTasks = sessions.reduce((sum, s) => sum + (s.taskCount ?? 0), 0);

  const successRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return { totalSessions, activeSessions, completedSessions, totalTasks, successRate };
}

function SessionStats({ sessions, loading }: SessionStatsProps) {
  const stats = React.useMemo(() => computeStats(sessions), [sessions]);

  return (
    <section aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="text-base font-semibold text-text-primary mb-3">
        Statistics
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          value={stats.totalSessions}
          label="Total Sessions"
          variant="default"
          size="sm"
          loading={loading}
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          value={stats.activeSessions}
          label="Active Sessions"
          variant={stats.activeSessions > 0 ? 'primary' : 'default'}
          size="sm"
          loading={loading}
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5" />}
          value={stats.completedSessions}
          label="Completed"
          variant="success"
          size="sm"
          loading={loading}
        />
        <StatCard
          icon={<ListTodo className="h-5 w-5" />}
          value={stats.totalTasks}
          label="Total Tasks"
          variant="default"
          size="sm"
          loading={loading}
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          value={`${stats.successRate}%`}
          label="Success Rate"
          variant={stats.successRate >= 80 ? 'success' : stats.successRate >= 50 ? 'warning' : 'error'}
          size="sm"
          loading={loading}
        />
      </div>
    </section>
  );
}

/* ============================================
   SESSION HISTORY
   ============================================ */

interface SessionHistoryProps {
  sessions: SessionWithStats[];
  loading?: boolean;
  onSelectSession?: (sessionId: string) => void;
}

const SESSION_STATUS_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  active: { icon: PlayCircle, color: 'text-accent-primary', label: 'Active' },
  paused: { icon: PauseCircle, color: 'text-warning', label: 'Paused' },
  completed: { icon: CheckCircle, color: 'text-success', label: 'Completed' },
  abandoned: { icon: XCircle, color: 'text-error', label: 'Abandoned' },
};

function SessionHistoryItem({
  session,
  onClick,
}: {
  session: SessionWithStats;
  onClick?: () => void;
}) {
  const fallback = { icon: PlayCircle, color: 'text-accent-primary', label: 'Active' };
  const config = SESSION_STATUS_CONFIG[session.status] ?? fallback;
  const StatusIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 sm:p-4 rounded-lg border bg-card transition-all duration-150',
        'hover:bg-surface-interactive hover:border-border-strong hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 shrink-0', config.color)}>
          <StatusIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">
              Session {session.id.slice(0, 8)}
            </span>
            <Badge
              variant={session.status === 'active' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {config.label}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
            {session.startBranch && (
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {session.startBranch}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ListTodo className="h-3 w-3" />
              {session.taskCount ?? 0} task{(session.taskCount ?? 0) !== 1 ? 's' : ''}
            </span>
            {session.startedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(new Date(session.startedAt))}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function SessionHistoryEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">No sessions yet</p>
        <p className="mt-1 text-xs text-text-muted max-w-[240px]">
          Start a new session to begin working with this repository
        </p>
      </div>
    </div>
  );
}

function SessionHistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border bg-card">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionHistory({ sessions, loading, onSelectSession }: SessionHistoryProps) {
  if (loading) {
    return (
      <section aria-labelledby="session-history-heading">
        <h2 id="session-history-heading" className="text-base font-semibold text-text-primary mb-3">
          Session History
        </h2>
        <SessionHistorySkeleton />
      </section>
    );
  }

  return (
    <section aria-labelledby="session-history-heading">
      <h2 id="session-history-heading" className="text-base font-semibold text-text-primary mb-3">
        Session History
      </h2>
      {sessions.length === 0 ? (
        <SessionHistoryEmpty />
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <SessionHistoryItem
              key={session.id}
              session={session}
              onClick={onSelectSession ? () => onSelectSession(session.id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================================
   QA GATES SECTION
   ============================================ */

interface QAGatesSectionProps {
  repositoryId: string;
}

function QAGatesSection({ repositoryId }: QAGatesSectionProps) {
  return (
    <section aria-labelledby="qa-gates-heading">
      <h2 id="qa-gates-heading" className="text-base font-semibold text-text-primary mb-3">
        QA Gates
      </h2>
      <QAGatesConfig repositoryId={repositoryId} />
    </section>
  );
}

/* ============================================
   UNCOMMITTED FILES
   ============================================ */

interface UncommittedFilesProps {
  files: string[];
}

function UncommittedFiles({ files }: UncommittedFilesProps) {
  const [expanded, setExpanded] = React.useState(false);
  const maxVisible = 5;
  const visibleFiles = expanded ? files : files.slice(0, maxVisible);
  const hasMore = files.length > maxVisible;

  return (
    <section aria-labelledby="uncommitted-heading">
      <h2 id="uncommitted-heading" className="text-base font-semibold text-text-primary mb-3">
        Uncommitted Files
        <Badge variant="secondary" className="ml-2 text-xs">
          {files.length}
        </Badge>
      </h2>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <ul className="space-y-1">
            {visibleFiles.map((file) => (
              <li key={file} className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="font-mono text-xs text-text-primary truncate">{file}</span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs w-full"
            >
              {expanded ? 'Show less' : `Show ${files.length - maxVisible} more`}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function RepositoryDetailView({
  repository,
  onBack,
  onStartSession,
  onSelectSession,
  className,
}: RepositoryDetailViewProps) {
  const { data: sessionsData, isLoading: sessionsLoading } = useListSessionsQuery({
    repositoryId: repository.id,
    limit: 20,
  });

  const sessions = sessionsData?.sessions ?? [];

  const uncommittedFiles = React.useMemo(() => {
    if (!repository.uncommittedFiles) return [];
    try {
      const parsed = JSON.parse(repository.uncommittedFiles);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [repository.uncommittedFiles]);

  return (
    <div className={cn('flex flex-col gap-6 sm:gap-8', className)}>
      {/* Header with repo info + actions */}
      <RepoHeader
        repository={repository}
        onBack={onBack}
        onStartSession={onStartSession}
      />

      {/* Statistics */}
      <SessionStats sessions={sessions} loading={sessionsLoading} />

      {/* Uncommitted files (only shown when dirty) */}
      {uncommittedFiles.length > 0 && <UncommittedFiles files={uncommittedFiles} />}

      {/* Session History */}
      <SessionHistory
        sessions={sessions}
        loading={sessionsLoading}
        onSelectSession={onSelectSession}
      />

      {/* QA Gates Configuration */}
      <QAGatesSection repositoryId={repository.id} />
    </div>
  );
}

export default RepositoryDetailView;
