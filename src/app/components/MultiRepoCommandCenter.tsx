'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/dashboard-cards';
import {
  useMultiRepoStream,
  type RepoSessionState,
  type ClaudeStatus,
} from '@/shared/hooks/useMultiRepoStream';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import type { StuckAlert, AlertSeverity } from '@/lib/stuck-detection/types';
import {
  Brain,
  Pencil,
  Clock,
  AlertTriangle,
  Pause,
  CircleDot,
  Play,
  Eye,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  GitBranch,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronUp,
  Zap,
  Timer,
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

type ViewMode = 'grid' | 'list';

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  animate?: 'pulse' | 'spin' | 'bounce';
  priority: number;
}

/* ============================================
   STATUS CONFIGURATION
   ============================================ */

const CLAUDE_STATUS_CONFIGS: Record<ClaudeStatus, StatusConfig> = {
  stuck: {
    icon: AlertTriangle,
    label: 'Stuck - Needs Help',
    shortLabel: 'Stuck',
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-red-300 dark:border-red-800',
    glowColor: 'shadow-red-500/20',
    animate: 'bounce',
    priority: 0,
  },
  waiting_input: {
    icon: Clock,
    label: 'Waiting for Input',
    shortLabel: 'Waiting',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-300 dark:border-amber-700',
    glowColor: 'shadow-amber-500/20',
    animate: 'pulse',
    priority: 1,
  },
  thinking: {
    icon: Brain,
    label: 'Thinking...',
    shortLabel: 'Thinking',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-300 dark:border-blue-700',
    glowColor: 'shadow-blue-500/20',
    animate: 'pulse',
    priority: 2,
  },
  writing: {
    icon: Pencil,
    label: 'Writing Code',
    shortLabel: 'Writing',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    glowColor: 'shadow-emerald-500/20',
    animate: 'pulse',
    priority: 3,
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    shortLabel: 'Paused',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800/40',
    borderColor: 'border-slate-300 dark:border-slate-700',
    glowColor: '',
    priority: 4,
  },
  idle: {
    icon: CircleDot,
    label: 'Idle',
    shortLabel: 'Idle',
    color: 'text-slate-400 dark:text-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    borderColor: 'border-slate-200 dark:border-slate-800',
    glowColor: '',
    priority: 5,
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

  if (hours > 0) return minutes % 60 > 0 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
  if (minutes > 0) return seconds % 60 > 0 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
  return `${seconds}s`;
}

function formatLastUpdated(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffSecs = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);

  if (diffSecs < 5) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

function sortByPriority(repos: RepoSessionState[]): RepoSessionState[] {
  return [...repos].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    const priorityDiff = CLAUDE_STATUS_CONFIGS[a.claudeStatus].priority - CLAUDE_STATUS_CONFIGS[b.claudeStatus].priority;
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

function truncateText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
}

function getAnimationClass(animate?: 'pulse' | 'spin' | 'bounce'): string {
  if (animate === 'pulse') return 'animate-pulse';
  if (animate === 'spin') return 'animate-spin';
  if (animate === 'bounce') return 'animate-bounce';
  return '';
}

/* ============================================
   STUCK ALERT SEVERITY STYLES
   ============================================ */

const SEVERITY_RING_STYLES: Record<AlertSeverity, { ring: string; glow: string; badge: string }> = {
  critical: {
    ring: 'ring-2 ring-red-500 ring-offset-2 ring-offset-background',
    glow: 'shadow-lg shadow-red-500/40',
    badge: 'bg-red-600 text-white',
  },
  high: {
    ring: 'ring-2 ring-orange-500 ring-offset-1 ring-offset-background',
    glow: 'shadow-md shadow-orange-500/30',
    badge: 'bg-orange-500 text-white',
  },
  medium: {
    ring: 'ring-1 ring-amber-500 ring-offset-1 ring-offset-background',
    glow: 'shadow-sm shadow-amber-500/20',
    badge: 'bg-amber-500 text-white',
  },
  low: {
    ring: 'ring-1 ring-yellow-500',
    glow: '',
    badge: 'bg-yellow-500 text-black',
  },
};

function formatStuckDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function useLiveStuckDuration(alert: StuckAlert | null): number {
  const [duration, setDuration] = useState(alert?.stuckDurationSeconds ?? 0);
  const alertId = alert?.id;

  useEffect(() => {
    if (!alertId) {
      setDuration(0);
      return;
    }
    setDuration(alert?.stuckDurationSeconds ?? 0);
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [alertId, alert?.stuckDurationSeconds]);

  return alertId ? duration : 0;
}

function getProgressBarColor(status: ClaudeStatus): string {
  if (status === 'stuck') return 'bg-red-500';
  if (status === 'waiting_input') return 'bg-amber-500';
  return 'bg-blue-500';
}

/* ============================================
   SUBCOMPONENTS - Status Indicator
   ============================================ */

interface LiveIndicatorProps {
  status: ClaudeStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZE_CLASSES = {
  sm: { icon: 'h-3 w-3', text: 'text-[10px]', gap: 'gap-1' },
  md: { icon: 'h-4 w-4', text: 'text-xs', gap: 'gap-1.5' },
  lg: { icon: 'h-5 w-5', text: 'text-sm', gap: 'gap-2' },
};

function LiveIndicator({ status, size = 'md', showLabel = true }: LiveIndicatorProps) {
  const config = CLAUDE_STATUS_CONFIGS[status];
  const Icon = config.icon;
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <div className={cn('flex items-center', sizeClasses.gap)}>
      <div className="relative flex items-center justify-center">
        <Icon className={cn(sizeClasses.icon, config.color, getAnimationClass(config.animate))} />
        {config.animate && (
          <span className={cn('absolute -inset-1 rounded-full opacity-30', config.bgColor, 'animate-ping')} />
        )}
      </div>
      {showLabel && (
        <span className={cn(sizeClasses.text, 'font-medium', config.color)}>{config.shortLabel}</span>
      )}
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Summary Stats
   ============================================ */

function SummaryStats({ repos }: { repos: RepoSessionState[] }) {
  const stats = useMemo(() => ({
    stuck: repos.filter(r => r.claudeStatus === 'stuck').length,
    waiting: repos.filter(r => r.claudeStatus === 'waiting_input').length,
    active: repos.filter(r => ['thinking', 'writing'].includes(r.claudeStatus)).length,
    idle: repos.filter(r => ['idle', 'paused'].includes(r.claudeStatus)).length,
  }), [repos]);

  if (repos.length === 0) return null;

  return (
    <div className="flex items-center gap-4 text-xs">
      {stats.stuck > 0 && (
        <StatItem icon={AlertTriangle} count={stats.stuck} label="stuck" color="text-red-600 dark:text-red-400" />
      )}
      {stats.waiting > 0 && (
        <StatItem icon={Clock} count={stats.waiting} label="waiting" color="text-amber-600 dark:text-amber-400" />
      )}
      {stats.active > 0 && (
        <StatItem icon={Zap} count={stats.active} label="active" color="text-emerald-600 dark:text-emerald-400" />
      )}
      {stats.idle > 0 && (
        <StatItem icon={CircleDot} count={stats.idle} label="idle" color="text-slate-500 dark:text-slate-400" />
      )}
    </div>
  );
}

function StatItem({ icon: Icon, count, label, color }: { icon: LucideIcon; count: number; label: string; color: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', color)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Connection Status
   ============================================ */

function ConnectionBadge({ connected, error, lastUpdated, onReconnect }: { connected: boolean; error: string | null; lastUpdated: string | null; onReconnect: () => void }) {
  const [displayTime, setDisplayTime] = useState(formatLastUpdated(lastUpdated));

  useEffect(() => {
    setDisplayTime(formatLastUpdated(lastUpdated));
    const interval = setInterval(() => setDisplayTime(formatLastUpdated(lastUpdated)), 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const badgeClass = connected
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : error
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors', badgeClass)}>
        <ConnectionIcon connected={connected} error={error} />
        <span>{connected ? 'Live' : error ? 'Offline' : 'Connecting'}</span>
      </div>
      <span className="text-xs text-muted-foreground">{displayTime}</span>
      {!connected && (
        <Button variant="ghost" size="sm" onClick={onReconnect} className="h-6 w-6 p-0" title="Retry connection">
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function ConnectionIcon({ connected, error }: { connected: boolean; error: string | null }) {
  if (connected) return <Wifi className="h-3 w-3" />;
  if (error) return <WifiOff className="h-3 w-3" />;
  return <Loader2 className="h-3 w-3 animate-spin" />;
}

/* ============================================
   SUBCOMPONENTS - Repo Card Parts
   ============================================ */

function RepoCardHeader({ repo, config }: { repo: RepoSessionState; config: StatusConfig }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0 border', config.bgColor, config.borderColor)}>
          <GitBranch className={cn('h-4 w-4', config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate text-sm">{repo.repositoryName}</h3>
          <p className="text-[10px] text-muted-foreground">{formatElapsedTime(repo.timeElapsed)} elapsed</p>
        </div>
      </div>
      <LiveIndicator status={repo.claudeStatus} size="sm" showLabel={false} />
    </div>
  );
}

function RepoCardTask({ repo }: { repo: RepoSessionState }) {
  return (
    <div className="mb-3 min-h-[2.5rem]">
      {repo.currentTask ? (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{truncateText(repo.currentTask.prompt, 80)}</p>
      ) : (
        <p className="text-sm text-muted-foreground/60 italic">No active task</p>
      )}
    </div>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: ClaudeStatus }) {
  if (progress <= 0) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium text-foreground">{progress}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', getProgressBarColor(status))} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function RepoCardActions({ canPause, canResume, onPause, onResume, onSelect }: { canPause: boolean; canResume: boolean; onPause?: () => void; onResume?: () => void; onSelect?: () => void }) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {canPause && onPause && (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onPause(); }} title="Pause session">
          <Pause className="h-3 w-3" />
        </Button>
      )}
      {canResume && onResume && (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onResume(); }} title="Resume session">
          <Play className="h-3 w-3" />
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onSelect?.(); }} title="View details">
        <Eye className="h-3 w-3" />
      </Button>
      <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
    </div>
  );
}

function RepoCardFooter({ config, canPause, canResume, onPause, onResume, onSelect }: { config: StatusConfig; canPause: boolean; canResume: boolean; onPause?: () => void; onResume?: () => void; onSelect?: () => void }) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-current/10">
      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', config.color, 'border-current/30')}>
        {config.shortLabel}
      </Badge>
      <RepoCardActions canPause={canPause} canResume={canResume} onPause={onPause} onResume={onResume} onSelect={onSelect} />
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Repo Card (Grid View)
   ============================================ */

interface RepoCardProps {
  repo: RepoSessionState;
  isSelected?: boolean;
  alert?: StuckAlert | null;
  onSelect?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

function getSessionPermissions(repo: RepoSessionState) {
  const hasActiveSession = !!repo.sessionId && (repo.sessionStatus === 'active' || repo.sessionStatus === 'paused');
  return {
    canPause: hasActiveSession && repo.sessionStatus === 'active',
    canResume: hasActiveSession && repo.sessionStatus === 'paused',
  };
}

function getAlertStyles(alert?: StuckAlert | null): { hasAlert: boolean; ring?: string; glow?: string } {
  const hasAlert = Boolean(alert && !alert.acknowledged);
  if (!hasAlert || !alert?.severity) return { hasAlert: false };
  const styles = SEVERITY_RING_STYLES[alert.severity];
  return { hasAlert: true, ring: styles.ring, glow: styles.glow };
}

function getCardClass(config: StatusConfig, isSelected: boolean, needsAttention: boolean, alert?: StuckAlert | null) {
  const alertStyles = getAlertStyles(alert);

  return cn(
    'group relative rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer',
    'hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    config.bgColor, config.borderColor,
    isSelected && !alertStyles.hasAlert && 'ring-2 ring-blue-500 ring-offset-2',
    alertStyles.hasAlert && alertStyles.ring,
    alertStyles.hasAlert && alertStyles.glow,
    alertStyles.hasAlert && 'animate-pulse-border',
    !alertStyles.hasAlert && needsAttention && 'animate-pulse-border shadow-lg',
    !alertStyles.hasAlert && needsAttention && config.glowColor
  );
}

function handleCardKeyDown(e: React.KeyboardEvent, onSelect?: () => void) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); }
}

function StuckDurationBadge({ alert }: { alert: StuckAlert }) {
  const duration = useLiveStuckDuration(alert);
  const isCritical = alert.severity === 'critical';
  const severityStyles = SEVERITY_RING_STYLES[alert.severity];

  return (
    <div className={cn(
      'absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold shadow-md z-10',
      severityStyles.badge,
      isCritical && 'animate-bounce'
    )}>
      <Timer className={cn('h-3 w-3', isCritical && 'animate-pulse')} />
      <span>{formatStuckDuration(duration)}</span>
      {isCritical && <span className="text-[8px]">!</span>}
    </div>
  );
}

function StuckReasonIndicator({ alert }: { alert: StuckAlert }) {
  const duration = useLiveStuckDuration(alert);
  const isCritical = alert.severity === 'critical';
  const isHigh = alert.severity === 'high';

  return (
    <div className={cn(
      'flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md text-xs',
      isCritical && 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300',
      isHigh && !isCritical && 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300',
      !isCritical && !isHigh && 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
    )}>
      <AlertTriangle className={cn('h-3 w-3 shrink-0', isCritical && 'animate-pulse')} />
      <span className="truncate">{alert.description}</span>
      <span className={cn('font-mono font-semibold shrink-0', isCritical && 'animate-pulse')}>
        {formatStuckDuration(duration)}
      </span>
    </div>
  );
}

const SEVERITY_BORDER_COLORS: Record<AlertSeverity, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-amber-500',
  low: 'border-yellow-500',
};

function CardPulsingBorder({ hasAlert, severity, needsAttention, fallbackBorder }: { hasAlert: boolean; severity?: AlertSeverity; needsAttention: boolean; fallbackBorder: string }) {
  if (hasAlert && severity) {
    return <div className={cn('absolute inset-0 rounded-xl border-2 animate-ping opacity-30 pointer-events-none', SEVERITY_BORDER_COLORS[severity])} />;
  }
  if (needsAttention) {
    return <div className={cn('absolute inset-0 rounded-xl border-2 animate-ping opacity-20 pointer-events-none', fallbackBorder)} />;
  }
  return null;
}

function RepoCard({ repo, isSelected, alert, onSelect, onPause, onResume }: RepoCardProps) {
  const config = CLAUDE_STATUS_CONFIGS[repo.claudeStatus];
  const { canPause, canResume } = getSessionPermissions(repo);
  const cardClass = getCardClass(config, !!isSelected, repo.needsAttention, alert);
  const hasAlert = Boolean(alert && !alert.acknowledged);

  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => handleCardKeyDown(e, onSelect)} className={cardClass}>
      {hasAlert && alert && <StuckDurationBadge alert={alert} />}
      <CardPulsingBorder hasAlert={hasAlert} severity={alert?.severity} needsAttention={repo.needsAttention} fallbackBorder={config.borderColor} />
      <RepoCardHeader repo={repo} config={config} />
      <RepoCardTask repo={repo} />
      {hasAlert && alert && <StuckReasonIndicator alert={alert} />}
      {repo.currentTask?.progress !== undefined && <ProgressBar progress={repo.currentTask.progress} status={repo.claudeStatus} />}
      <RepoCardFooter config={config} canPause={canPause} canResume={canResume} onPause={onPause} onResume={onResume} onSelect={onSelect} />
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Repo Row Parts (List View)
   ============================================ */

function RepoRowInfo({ repo, config }: { repo: RepoSessionState; config: StatusConfig }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="font-semibold text-foreground truncate text-sm">{repo.repositoryName}</h3>
        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', config.color, 'border-current/30')}>
          {config.shortLabel}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {repo.currentTask ? truncateText(repo.currentTask.prompt, 60) : 'No active task'}
      </p>
    </div>
  );
}

function RepoRowActions({ canPause, canResume, onPause, onResume, onSelect }: { canPause: boolean; canResume: boolean; onPause?: () => void; onResume?: () => void; onSelect?: () => void }) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {canPause && onPause && (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onPause(); }} title="Pause session">
          <Pause className="h-3.5 w-3.5" />
        </Button>
      )}
      {canResume && onResume && (
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onResume(); }} title="Resume session">
          <Play className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onSelect?.(); }} title="View details">
        <Eye className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Repo Row (List View)
   ============================================ */

function getRowClass(config: StatusConfig, isSelected: boolean, needsAttention: boolean, alert?: StuckAlert | null) {
  const alertStyles = getAlertStyles(alert);

  return cn(
    'group flex items-center gap-4 px-4 py-3 rounded-lg border-2 transition-all duration-200 cursor-pointer',
    'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    config.bgColor, config.borderColor,
    isSelected && !alertStyles.hasAlert && 'ring-2 ring-blue-500 ring-offset-2',
    alertStyles.hasAlert && alertStyles.ring,
    alertStyles.hasAlert && alertStyles.glow,
    alertStyles.hasAlert && 'animate-pulse-border',
    !alertStyles.hasAlert && needsAttention && 'animate-pulse-border shadow-md',
    !alertStyles.hasAlert && needsAttention && config.glowColor
  );
}

function RepoRowProgress({ progress, status }: { progress: number; status: ClaudeStatus }) {
  return (
    <div className="w-24 hidden sm:block">
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="font-medium">{progress}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', getProgressBarColor(status))} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function StuckDurationCell({ alert }: { alert: StuckAlert }) {
  const duration = useLiveStuckDuration(alert);
  const isCritical = alert.severity === 'critical';
  const severityStyles = SEVERITY_RING_STYLES[alert.severity];

  return (
    <div className={cn(
      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold shrink-0',
      severityStyles.badge,
      isCritical && 'animate-pulse'
    )}>
      <Timer className="h-3 w-3" />
      <span>{formatStuckDuration(duration)}</span>
    </div>
  );
}

const SEVERITY_BG_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-yellow-500',
};

function AlertIndicatorDot({ severity }: { severity: AlertSeverity }) {
  return <span className={cn('absolute -top-1 -right-1 h-3 w-3 rounded-full animate-pulse', SEVERITY_BG_COLORS[severity])} />;
}

function RepoRowIconBox({ config, claudeStatus, alert }: { config: StatusConfig; claudeStatus: ClaudeStatus; alert?: StuckAlert | null }) {
  const hasAlert = Boolean(alert && !alert.acknowledged);
  return (
    <div className={cn('relative flex items-center justify-center h-10 w-10 rounded-lg shrink-0 border', config.bgColor, config.borderColor)}>
      <LiveIndicator status={claudeStatus} size="md" showLabel={false} />
      {hasAlert && alert?.severity && <AlertIndicatorDot severity={alert.severity} />}
    </div>
  );
}

function RepoRow({ repo, isSelected, alert, onSelect, onPause, onResume }: RepoCardProps) {
  const config = CLAUDE_STATUS_CONFIGS[repo.claudeStatus];
  const { canPause, canResume } = getSessionPermissions(repo);
  const rowClass = getRowClass(config, !!isSelected, repo.needsAttention, alert);
  const showProgress = repo.currentTask?.progress !== undefined && repo.currentTask.progress > 0;
  const hasAlert = Boolean(alert && !alert.acknowledged);

  return (
    <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => handleCardKeyDown(e, onSelect)} className={rowClass}>
      <RepoRowIconBox config={config} claudeStatus={repo.claudeStatus} alert={alert} />
      <RepoRowInfo repo={repo} config={config} />
      {hasAlert && alert ? <StuckDurationCell alert={alert} /> : showProgress && <RepoRowProgress progress={repo.currentTask!.progress!} status={repo.claudeStatus} />}
      <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">{formatElapsedTime(repo.timeElapsed)}</div>
      <RepoRowActions canPause={canPause} canResume={canResume} onPause={onPause} onResume={onResume} onSelect={onSelect} />
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Loading States
   ============================================ */

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border-2 border-border p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-3 w-16" /></div>
            </div>
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-10 w-full mb-3" />
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Skeleton className="h-5 w-16" /><Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg border-2 border-border">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1"><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-48" /></div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-muted/50 mb-4">
        <GitBranch className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">No repositories found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">Add repositories to start monitoring your multi-repo sessions with live updates.</p>
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Header & Toggle
   ============================================ */

function ViewModeToggle({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => setViewMode('grid')} title="Grid view">
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => setViewMode('list')} title="List view">
        <LayoutList className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CommandCenterHeader({ repos, connected, error, lastUpdated, reconnect, viewMode, setViewMode }: { repos: RepoSessionState[]; connected: boolean; error: string | null; lastUpdated: string | null; reconnect: () => void; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <>
      <div className="flex flex-col gap-4 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Command Center</h2>
            <ConnectionBadge connected={connected} error={error} lastUpdated={lastUpdated} onReconnect={reconnect} />
          </div>
          {repos.length > 0 && <p className="text-sm text-muted-foreground">Monitoring {repos.length} repositor{repos.length === 1 ? 'y' : 'ies'}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block"><SummaryStats repos={repos} /></div>
          <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
      </div>
      {repos.length > 0 && <div className="px-6 pb-4 md:hidden"><SummaryStats repos={repos} /></div>}
    </>
  );
}

function ShowMoreButton({ hiddenCount, isExpanded, setIsExpanded }: { hiddenCount: number; isExpanded: boolean; setIsExpanded: (expanded: boolean) => void }) {
  if (hiddenCount <= 0) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="gap-1.5">
        {isExpanded ? <><ChevronUp className="h-4 w-4" />Show less</> : <><ChevronDown className="h-4 w-4" />Show {hiddenCount} more repositor{hiddenCount === 1 ? 'y' : 'ies'}</>}
      </Button>
    </div>
  );
}

/* ============================================
   SUBCOMPONENTS - Content Renderers
   ============================================ */

function RepoGrid({ repos, selectedRepoId, alerts, onSelect, onPause, onResume }: { repos: RepoSessionState[]; selectedRepoId?: string; alerts: Map<string, StuckAlert>; onSelect: (id: string) => void; onPause: (repoId: string, sessionId: string) => void; onResume: (repoId: string, sessionId: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {repos.map((repo) => (
        <RepoCard
          key={repo.repositoryId}
          repo={repo}
          isSelected={repo.repositoryId === selectedRepoId}
          alert={alerts.get(repo.repositoryId)}
          onSelect={() => onSelect(repo.repositoryId)}
          onPause={repo.sessionId ? () => onPause(repo.repositoryId, repo.sessionId!) : undefined}
          onResume={repo.sessionId ? () => onResume(repo.repositoryId, repo.sessionId!) : undefined}
        />
      ))}
    </div>
  );
}

function RepoList({ repos, selectedRepoId, alerts, onSelect, onPause, onResume }: { repos: RepoSessionState[]; selectedRepoId?: string; alerts: Map<string, StuckAlert>; onSelect: (id: string) => void; onPause: (repoId: string, sessionId: string) => void; onResume: (repoId: string, sessionId: string) => void }) {
  return (
    <div className="space-y-2">
      {repos.map((repo) => (
        <RepoRow
          key={repo.repositoryId}
          repo={repo}
          isSelected={repo.repositoryId === selectedRepoId}
          alert={alerts.get(repo.repositoryId)}
          onSelect={() => onSelect(repo.repositoryId)}
          onPause={repo.sessionId ? () => onPause(repo.repositoryId, repo.sessionId!) : undefined}
          onResume={repo.sessionId ? () => onResume(repo.repositoryId, repo.sessionId!) : undefined}
        />
      ))}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function MultiRepoCommandCenter({ onSelectRepo, onPauseRepo, onResumeRepo, selectedRepoId, maxVisible = 8, className }: MultiRepoCommandCenterProps) {
  const { repositories, connected, error, reconnect, lastUpdated } = useMultiRepoStream();
  const { status: stuckStatus } = useStuckDetection();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isExpanded, setIsExpanded] = useState(false);

  // Create alerts map for quick lookup
  const alertsMap = useMemo(() => {
    const map = new Map<string, StuckAlert>();
    stuckStatus?.alerts.forEach(alert => {
      if (!alert.acknowledged) {
        map.set(alert.repositoryId, alert);
      }
    });
    return map;
  }, [stuckStatus?.alerts]);

  const sortedRepos = useMemo(() => sortByPriority(repositories), [repositories]);
  const visibleRepos = useMemo(() => isExpanded ? sortedRepos : sortedRepos.slice(0, maxVisible), [sortedRepos, maxVisible, isExpanded]);
  const hiddenCount = sortedRepos.length - maxVisible;
  const isLoading = !connected && repositories.length === 0 && !error;

  const handleSelect = useCallback((repoId: string) => onSelectRepo?.(repoId), [onSelectRepo]);
  const handlePause = useCallback((repoId: string, sessionId: string) => onPauseRepo?.(repoId, sessionId), [onPauseRepo]);
  const handleResume = useCallback((repoId: string, sessionId: string) => onResumeRepo?.(repoId, sessionId), [onResumeRepo]);

  const renderContent = () => {
    if (isLoading) return viewMode === 'grid' ? <GridSkeleton /> : <ListSkeleton />;
    if (repositories.length === 0) return <EmptyState />;
    if (viewMode === 'grid') return <RepoGrid repos={visibleRepos} selectedRepoId={selectedRepoId} alerts={alertsMap} onSelect={handleSelect} onPause={handlePause} onResume={handleResume} />;
    return <RepoList repos={visibleRepos} selectedRepoId={selectedRepoId} alerts={alertsMap} onSelect={handleSelect} onPause={handlePause} onResume={handleResume} />;
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CommandCenterHeader repos={sortedRepos} connected={connected} error={error} lastUpdated={lastUpdated} reconnect={reconnect} viewMode={viewMode} setViewMode={setViewMode} />
      <CardContent className="pt-0">
        {renderContent()}
        {!isLoading && repositories.length > 0 && <ShowMoreButton hiddenCount={hiddenCount} isExpanded={isExpanded} setIsExpanded={setIsExpanded} />}
      </CardContent>
    </Card>
  );
}

export default MultiRepoCommandCenter;
