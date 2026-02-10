'use client';

import { useMemo, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/dashboard-cards';
import {
  useMultiRepoStream,
  type RepoSessionState,
  type ClaudeStatus,
} from '@/shared/hooks/useMultiRepoStream';
import {
  Brain,
  Pencil,
  Clock,
  AlertTriangle,
  Pause,
  CircleDot,
  Play,
  Eye,
  ArrowRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface MultiRepoCommandCenterProps {
  onSelectRepo?: (repositoryId: string) => void;
  onPauseRepo?: (repositoryId: string, sessionId: string) => void;
  onResumeRepo?: (repositoryId: string, sessionId: string) => void;
  selectedRepoId?: string;
  maxVisible?: number;
  className?: string;
}

/* ============================================
   STATUS CONFIGURATION
   ============================================ */

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  animate?: boolean;
}

const CLAUDE_STATUS_CONFIGS: Record<ClaudeStatus, StatusConfig> = {
  idle: {
    icon: CircleDot,
    label: 'Idle',
    color: 'text-text-muted',
    bgColor: 'bg-muted/50',
    borderColor: 'border-border-default',
  },
  thinking: {
    icon: Brain,
    label: 'Thinking',
    color: 'text-info',
    bgColor: 'bg-info/10',
    borderColor: 'border-info/30',
    animate: true,
  },
  writing: {
    icon: Pencil,
    label: 'Writing',
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    animate: true,
  },
  waiting_input: {
    icon: Clock,
    label: 'Waiting',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/40',
  },
  stuck: {
    icon: AlertTriangle,
    label: 'Stuck',
    color: 'text-error',
    bgColor: 'bg-error/10',
    borderColor: 'border-error/40',
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    color: 'text-text-secondary',
    bgColor: 'bg-muted/30',
    borderColor: 'border-border-muted',
  },
};

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

function formatElapsedTime(ms: number): string {
  if (ms < 1000) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatLastUpdated(isoString: string | null): string {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 5) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  return date.toLocaleTimeString();
}

/**
 * Sort repositories with priority: stuck/waiting first, then by activity
 */
function sortByPriority(repos: RepoSessionState[]): RepoSessionState[] {
  return [...repos].sort((a, b) => {
    // Needs attention first (stuck, waiting_input)
    if (a.needsAttention && !b.needsAttention) return -1;
    if (!a.needsAttention && b.needsAttention) return 1;

    // Then by Claude status priority
    const statusPriority: Record<ClaudeStatus, number> = {
      stuck: 0,
      waiting_input: 1,
      thinking: 2,
      writing: 3,
      paused: 4,
      idle: 5,
    };

    const aPriority = statusPriority[a.claudeStatus];
    const bPriority = statusPriority[b.claudeStatus];
    if (aPriority !== bPriority) return aPriority - bPriority;

    // Then by last activity (most recent first)
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

/* ============================================
   SUBCOMPONENTS
   ============================================ */

interface StatusIndicatorProps {
  status: ClaudeStatus;
  size?: 'sm' | 'md';
}

function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const config = CLAUDE_STATUS_CONFIGS[status];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('relative flex items-center justify-center', config.animate && 'animate-pulse')}>
        <Icon className={cn(iconSize, config.color)} />
        {config.animate && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-50', config.bgColor, 'animate-ping')} />
        )}
      </div>
      <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
    </div>
  );
}

interface RepoCardProps {
  repo: RepoSessionState;
  isSelected?: boolean;
  onSelect?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

function RepoCardHeader({ repo }: { repo: RepoSessionState }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <GitBranch className="h-4 w-4 text-text-muted shrink-0" />
        <h3 className="font-semibold text-text-primary truncate">{repo.repositoryName}</h3>
      </div>
      <StatusIndicator status={repo.claudeStatus} />
    </div>
  );
}

function RepoCardTask({ repo }: { repo: RepoSessionState }) {
  if (repo.currentTask) {
    return <p className="text-sm text-text-secondary line-clamp-2 mb-3 min-h-[2.5rem]">{repo.currentTask.prompt}</p>;
  }
  return <p className="text-sm text-text-muted italic mb-3 min-h-[2.5rem]">No active task</p>;
}

function RepoCardProgress({ progress }: { progress: number }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-text-muted">Progress</span>
        <span className="font-medium text-text-primary">{progress}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-accent-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

interface RepoCardActionsProps {
  showPause: boolean;
  showResume: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onSelect?: () => void;
}

function RepoCardActions({ showPause, showResume, onPause, onResume, onSelect }: RepoCardActionsProps) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {showPause && onPause && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onPause(); }} title="Pause session">
          <Pause className="h-3.5 w-3.5" />
        </Button>
      )}
      {showResume && onResume && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onResume(); }} title="Resume session">
          <Play className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onSelect?.(); }} title="View details">
        <Eye className="h-3.5 w-3.5" />
      </Button>
      <ArrowRight className="h-3.5 w-3.5 text-text-muted group-hover:text-text-primary transition-colors" />
    </div>
  );
}

function RepoCardFooter({ repo, onPause, onResume, onSelect }: { repo: RepoSessionState; onPause?: () => void; onResume?: () => void; onSelect?: () => void }) {
  const hasActiveSession = !!repo.sessionId && (repo.sessionStatus === 'active' || repo.sessionStatus === 'paused');
  return (
    <div className="flex items-center justify-between pt-2 border-t border-border-muted">
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span title="Time elapsed">{formatElapsedTime(repo.timeElapsed)}</span>
        {repo.sessionId && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{repo.sessionStatus}</Badge>}
      </div>
      <RepoCardActions
        showPause={hasActiveSession && repo.sessionStatus === 'active'}
        showResume={hasActiveSession && repo.sessionStatus === 'paused'}
        onPause={onPause}
        onResume={onResume}
        onSelect={onSelect}
      />
    </div>
  );
}

function getRepoCardClassName(config: StatusConfig, isSelected: boolean, needsAttention: boolean): string {
  return cn(
    'group relative rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer',
    'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    config.borderColor, config.bgColor,
    isSelected && 'ring-2 ring-accent-primary ring-offset-2',
    needsAttention && 'animate-pulse-border'
  );
}

function RepoCard({ repo, isSelected, onSelect, onPause, onResume }: RepoCardProps) {
  const config = CLAUDE_STATUS_CONFIGS[repo.claudeStatus];
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); } };

  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={handleKeyDown} className={getRepoCardClassName(config, !!isSelected, repo.needsAttention)}>
      {repo.needsAttention && <div className={cn('absolute inset-0 rounded-lg border-2 animate-ping opacity-30', config.borderColor)} />}
      <RepoCardHeader repo={repo} />
      <RepoCardTask repo={repo} />
      {repo.currentTask?.progress !== undefined && <RepoCardProgress progress={repo.currentTask.progress} />}
      <RepoCardFooter repo={repo} onPause={onPause} onResume={onResume} onSelect={onSelect} />
    </div>
  );
}

function RepoCardSkeleton() {
  return (
    <div className="rounded-lg border-2 border-border-default p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-10 w-full mb-3" />
      <div className="flex items-center justify-between pt-2 border-t border-border-muted">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

interface ConnectionStatusProps {
  connected: boolean;
  error: string | null;
  lastUpdated: string | null;
  onReconnect: () => void;
}

function ConnectionStatus({ connected, error, lastUpdated, onReconnect }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        {connected ? (
          <Wifi className="h-3.5 w-3.5 text-success" />
        ) : error ? (
          <WifiOff className="h-3.5 w-3.5 text-error" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 text-text-muted animate-spin" />
        )}
        <span className={cn(connected ? 'text-success' : error ? 'text-error' : 'text-text-muted')}>
          {connected ? 'Live' : error ? 'Disconnected' : 'Connecting...'}
        </span>
      </div>
      <span className="text-text-muted">Updated {formatLastUpdated(lastUpdated)}</span>
      {!connected && (
        <Button variant="ghost" size="sm" onClick={onReconnect} className="h-6 px-2 text-xs">
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <GitBranch className="h-12 w-12 text-text-muted mb-4" />
      <h3 className="font-semibold text-text-primary mb-1">No repositories found</h3>
      <p className="text-sm text-text-muted max-w-sm">
        Add repositories to start monitoring your multi-repo sessions.
      </p>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

interface RepoGridProps {
  repos: RepoSessionState[];
  selectedRepoId?: string;
  onSelect: (repoId: string) => void;
  onPause: (repoId: string, sessionId: string) => void;
  onResume: (repoId: string, sessionId: string) => void;
}

function RepoGrid({ repos, selectedRepoId, onSelect, onPause, onResume }: RepoGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {repos.map((repo) => (
        <RepoCard
          key={repo.repositoryId}
          repo={repo}
          isSelected={repo.repositoryId === selectedRepoId}
          onSelect={() => onSelect(repo.repositoryId)}
          onPause={repo.sessionId ? () => onPause(repo.repositoryId, repo.sessionId!) : undefined}
          onResume={repo.sessionId ? () => onResume(repo.repositoryId, repo.sessionId!) : undefined}
        />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <RepoCardSkeleton key={i} />)}
    </div>
  );
}

function CommandCenterHeader({ repos, connected, error, lastUpdated, reconnect }: { repos: RepoSessionState[]; connected: boolean; error: string | null; lastUpdated: string | null; reconnect: () => void }) {
  const attentionCount = repos.filter((r) => r.needsAttention).length;
  return (
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg font-semibold">Command Center</CardTitle>
        <ConnectionStatus connected={connected} error={error} lastUpdated={lastUpdated} onReconnect={reconnect} />
      </div>
      {repos.length > 0 && (
        <p className="text-sm text-text-muted mt-1">
          Monitoring {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'}
          {attentionCount > 0 && <span className="text-warning ml-2">({attentionCount} need attention)</span>}
        </p>
      )}
    </CardHeader>
  );
}

/**
 * MultiRepoCommandCenter - Hero section for dashboard
 */
export function MultiRepoCommandCenter({ onSelectRepo, onPauseRepo, onResumeRepo, selectedRepoId, maxVisible = 6, className }: MultiRepoCommandCenterProps) {
  const { repositories, connected, error, reconnect, lastUpdated } = useMultiRepoStream();
  const sortedRepos = useMemo(() => sortByPriority(repositories), [repositories]);
  const visibleRepos = useMemo(() => sortedRepos.slice(0, maxVisible), [sortedRepos, maxVisible]);
  const hiddenCount = sortedRepos.length - visibleRepos.length;
  const isLoading = !connected && repositories.length === 0 && !error;

  const handleSelect = useCallback((repoId: string) => onSelectRepo?.(repoId), [onSelectRepo]);
  const handlePause = useCallback((repoId: string, sessionId: string) => onPauseRepo?.(repoId, sessionId), [onPauseRepo]);
  const handleResume = useCallback((repoId: string, sessionId: string) => onResumeRepo?.(repoId, sessionId), [onResumeRepo]);

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CommandCenterHeader repos={sortedRepos} connected={connected} error={error} lastUpdated={lastUpdated} reconnect={reconnect} />
      <CardContent>
        {isLoading ? <LoadingSkeleton /> : repositories.length === 0 ? <EmptyState /> : (
          <>
            <RepoGrid repos={visibleRepos} selectedRepoId={selectedRepoId} onSelect={handleSelect} onPause={handlePause} onResume={handleResume} />
            {hiddenCount > 0 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" className="text-xs">Show {hiddenCount} more repositor{hiddenCount === 1 ? 'y' : 'ies'}</Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default MultiRepoCommandCenter;
