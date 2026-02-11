'use client';

import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  useMultiRepoStream,
  type RepoSessionState,
  type ClaudeStatus,
} from '@/shared/hooks/useMultiRepoStream';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import type { StuckAlert } from '@/lib/stuck-detection/types';
import {
  Brain,
  Pencil,
  Clock,
  AlertTriangle,
  Pause,
  CircleDot,
  GitBranch,
  ChevronUp,
  Wifi,
  WifiOff,
  Loader2,
  X,
  Bell,
  type LucideIcon,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface QuickSwitchDockProps {
  /** Currently selected repository ID */
  selectedRepoId?: string;
  /** Callback when a repository is selected */
  onSelectRepo?: (repositoryId: string, sessionId?: string | null) => void;
  /** Position of the dock */
  position?: 'top' | 'bottom';
  /** Additional class name */
  className?: string;
}

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  animate?: 'pulse' | 'slow-pulse' | 'alert';
  priority: number;
}

/* ============================================
   STATUS CONFIGURATION
   ============================================ */

const STATUS_CONFIGS: Record<ClaudeStatus, StatusConfig> = {
  writing: {
    icon: Pencil,
    label: 'Active',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    animate: 'pulse',
    priority: 0,
  },
  thinking: {
    icon: Brain,
    label: 'Thinking',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30',
    dotColor: 'bg-blue-500',
    animate: 'pulse',
    priority: 1,
  },
  waiting_input: {
    icon: Clock,
    label: 'Waiting',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30',
    dotColor: 'bg-amber-500',
    animate: 'slow-pulse',
    priority: 2,
  },
  stuck: {
    icon: AlertTriangle,
    label: 'Stuck',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 dark:bg-red-500/20 border-red-500/30',
    dotColor: 'bg-red-500',
    animate: 'alert',
    priority: 3,
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20 border-slate-500/30',
    dotColor: 'bg-slate-400',
    priority: 4,
  },
  idle: {
    icon: CircleDot,
    label: 'Idle',
    color: 'text-slate-400 dark:text-slate-500',
    bgColor: 'bg-slate-500/5 dark:bg-slate-500/10 border-slate-500/20',
    dotColor: 'bg-slate-400',
    priority: 5,
  },
};

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

function sortByActivityAndPriority(repos: RepoSessionState[]): RepoSessionState[] {
  return [...repos].sort((a, b) => {
    // First, prioritize repos that need attention
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    // Then by status priority (active states first)
    const priorityDiff = STATUS_CONFIGS[a.claudeStatus].priority - STATUS_CONFIGS[b.claudeStatus].priority;
    if (priorityDiff !== 0) return priorityDiff;
    // Finally by recent activity
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

function getShortName(name: string): string {
  // Truncate long names intelligently
  if (name.length <= 12) return name;
  // Try to break at common separators
  const parts = name.split(/[-_./]/);
  if (parts.length > 1 && parts[0]) {
    // Return first part if short enough, otherwise truncate
    return parts[0].length <= 10 ? parts[0] : parts[0].substring(0, 8) + '…';
  }
  return name.substring(0, 10) + '…';
}

function getAnimationClass(animate?: 'pulse' | 'slow-pulse' | 'alert'): string {
  switch (animate) {
    case 'pulse': return 'animate-pulse-fast';
    case 'slow-pulse': return 'animate-pulse-slow';
    case 'alert': return 'animate-pulse-alert';
    default: return '';
  }
}

/* ============================================
   SUBCOMPONENTS - Status Dot
   ============================================ */

interface StatusDotProps {
  status: ClaudeStatus;
  size?: 'sm' | 'md';
}

function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const config = STATUS_CONFIGS[status];
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  return (
    <span className="relative flex">
      <span
        className={cn(
          sizeClass,
          'rounded-full',
          config.dotColor,
          config.animate && getAnimationClass(config.animate)
        )}
      />
      {config.animate && (
        <span
          className={cn(
            'absolute inset-0 rounded-full opacity-75',
            config.dotColor,
            'animate-ping'
          )}
          style={{ animationDuration: config.animate === 'slow-pulse' ? '2s' : '1s' }}
        />
      )}
    </span>
  );
}

/* ============================================
   SUBCOMPONENTS - Repo Pill
   ============================================ */

interface RepoPillProps {
  repo: RepoSessionState;
  isSelected: boolean;
  shortcutNumber?: number;
  stuckAlert?: StuckAlert | null;
  onClick: () => void;
}

/**
 * Hook to create a live counting stuck duration
 * Updates every second for real-time feedback
 */
function useLiveStuckDuration(stuckAlert: StuckAlert | null | undefined): number {
  const alertId = stuckAlert?.id;
  const initialDuration = stuckAlert?.stuckDurationSeconds ?? 0;
  const [liveDuration, setLiveDuration] = useState(initialDuration);

  useEffect(() => {
    if (!alertId) {
      setLiveDuration(0);
      return;
    }

    // Initialize with current duration
    setLiveDuration(initialDuration);

    // Update every second
    const interval = setInterval(() => {
      setLiveDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [alertId, initialDuration]); // Reset when alert changes

  return alertId ? liveDuration : 0;
}

function RepoPillBadges({ hasStuckAlert, stuckAlert, shortcutNumber }: { hasStuckAlert: boolean; stuckAlert?: StuckAlert | null; shortcutNumber?: number }) {
  const liveDuration = useLiveStuckDuration(stuckAlert);

  return (
    <>
      {hasStuckAlert && <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold animate-bounce">!</span>}
      {stuckAlert && liveDuration > 0 && <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded bg-red-500/90 text-white text-[8px] font-mono whitespace-nowrap">{formatStuckTime(liveDuration)}</span>}
      {shortcutNumber && !hasStuckAlert && <span className="hidden group-hover:flex absolute -top-5 left-1/2 -translate-x-1/2 items-center justify-center px-1.5 py-0.5 rounded bg-foreground/90 text-background text-[10px] font-mono whitespace-nowrap">⌘{shortcutNumber}</span>}
    </>
  );
}

function getStuckAlertClasses(severity?: string): string {
  if (severity === 'critical') {
    return 'ring-red-600 bg-red-500/20 border-red-500 animate-pulse shadow-lg shadow-red-500/30';
  }
  if (severity === 'high') {
    return 'ring-orange-500 bg-orange-500/15 border-orange-500 animate-pulse shadow-md shadow-orange-500/20';
  }
  return 'ring-red-500 bg-red-500/10 border-red-400 animate-pulse';
}

function getRepoPillClassName(config: StatusConfig, isSelected: boolean, needsAttention: boolean, hasStuckAlert: boolean, severity?: string) {
  const baseClasses = cn(
    'group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200',
    'hover:scale-105 active:scale-95',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    config.bgColor
  );

  if (hasStuckAlert) {
    return cn(baseClasses, 'ring-2 ring-offset-1', getStuckAlertClasses(severity));
  }

  return cn(
    baseClasses,
    isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
    needsAttention && 'animate-pulse-border'
  );
}

function RepoPill({ repo, isSelected, shortcutNumber, stuckAlert, onClick }: RepoPillProps) {
  const config = STATUS_CONFIGS[repo.claudeStatus];
  const shortName = getShortName(repo.repositoryName);
  const hasStuckAlert = Boolean(stuckAlert && !stuckAlert.acknowledged);
  const title = `${repo.repositoryName} - ${config.label}${shortcutNumber ? ` (⌘${shortcutNumber})` : ''}${stuckAlert ? ` - ${stuckAlert.description}` : ''}`;

  return (
    <button onClick={onClick} className={getRepoPillClassName(config, isSelected, repo.needsAttention, hasStuckAlert, stuckAlert?.severity)} title={title}>
      <GitBranch className={cn('h-3.5 w-3.5 shrink-0', hasStuckAlert ? 'text-red-500' : config.color)} />
      <span className={cn('text-xs font-medium truncate max-w-[100px]', hasStuckAlert ? 'text-red-600 dark:text-red-400' : config.color)}>{shortName}</span>
      <StatusDot status={repo.claudeStatus} size="sm" />
      <RepoPillBadges hasStuckAlert={hasStuckAlert} stuckAlert={stuckAlert} shortcutNumber={shortcutNumber} />
    </button>
  );
}

function formatStuckTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

/* ============================================
   SUBCOMPONENTS - Mobile Bottom Sheet
   ============================================ */

interface MobileBottomSheetProps {
  repos: RepoSessionState[];
  selectedRepoId?: string;
  onSelectRepo: (repoId: string, sessionId?: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
  connected: boolean;
}

/* eslint-disable max-lines-per-function */
function MobileBottomSheet({ repos, selectedRepoId, onSelectRepo, isOpen, onClose, connected }: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      startY.current = touch.clientY;
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (!touch) return;
    const delta = touch.clientY - startY.current;
    // Only allow dragging down
    setDragY(Math.max(0, delta));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // If dragged more than 100px, close the sheet
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 md:hidden',
          'bg-background rounded-t-2xl border-t shadow-xl',
          'transform transition-transform duration-200',
          isDragging && 'transition-none'
        )}
        style={{ transform: `translateY(${dragY}px)` }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Quick Switch</h3>
            <ConnectionIndicator connected={connected} size="sm" />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Repo Grid */}
        <div className="px-4 pb-6 safe-bottom max-h-[50vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {repos.map((repo) => {
              const config = STATUS_CONFIGS[repo.claudeStatus];
              const Icon = config.icon;
              const isSelected = repo.repositoryId === selectedRepoId;

              return (
                <button
                  key={repo.repositoryId}
                  onClick={() => {
                    onSelectRepo(repo.repositoryId, repo.sessionId);
                    onClose();
                  }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    'active:scale-95',
                    config.bgColor,
                    isSelected && 'ring-2 ring-primary'
                  )}
                >
                  <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg', config.bgColor)}>
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={cn('text-sm font-medium truncate', config.color)}>
                      {repo.repositoryName}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={repo.claudeStatus} size="sm" />
                      <span className="text-[10px] text-muted-foreground">{config.label}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================
   SUBCOMPONENTS - Connection Indicator
   ============================================ */

interface ConnectionIndicatorProps {
  connected: boolean;
  error?: string | null;
  size?: 'sm' | 'md';
}

function ConnectionIndicator({ connected, error, size = 'md' }: ConnectionIndicatorProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (connected) {
    return (
      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <Wifi className={iconSize} />
        {size === 'md' && <span className="text-[10px] font-medium">Live</span>}
      </span>
    );
  }

  if (error) {
    return (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <WifiOff className={iconSize} />
        {size === 'md' && <span className="text-[10px] font-medium">Offline</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      <Loader2 className={cn(iconSize, 'animate-spin')} />
      {size === 'md' && <span className="text-[10px] font-medium">Connecting</span>}
    </span>
  );
}

/* ============================================
   SUBCOMPONENTS - Mobile Tab Bar
   ============================================ */

interface MobileTabBarProps {
  repos: RepoSessionState[];
  selectedRepoId?: string;
  onSelectRepo: (repoId: string, sessionId?: string | null) => void;
  onExpandSheet: () => void;
  connected: boolean;
}

/* eslint-disable max-lines-per-function */
function MobileTabBar({ repos, selectedRepoId, onSelectRepo, onExpandSheet, connected }: MobileTabBarProps) {
  // Show at most 4 repos in the tab bar, prioritized by activity
  const visibleRepos = repos.slice(0, 4);
  const hasMore = repos.length > 4;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {visibleRepos.map((repo) => {
          const config = STATUS_CONFIGS[repo.claudeStatus];
          const Icon = config.icon;
          const isSelected = repo.repositoryId === selectedRepoId;

          return (
            <button
              key={repo.repositoryId}
              onClick={() => onSelectRepo(repo.repositoryId, repo.sessionId)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all',
                'active:scale-95',
                isSelected && 'bg-primary/10'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : config.color)} />
                <span className={cn(
                  'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full',
                  config.dotColor,
                  config.animate && 'animate-pulse'
                )} />
              </div>
              <span className={cn(
                'text-[10px] truncate max-w-[60px]',
                isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {getShortName(repo.repositoryName)}
              </span>
            </button>
          );
        })}

        {/* More button */}
        {(hasMore || repos.length === 0) && (
          <button
            onClick={onExpandSheet}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all active:scale-95"
          >
            <div className="relative flex items-center justify-center h-5 w-5">
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
              {!connected && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {hasMore ? `+${repos.length - 4}` : 'Repos'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

/* eslint-disable max-lines-per-function */
export function QuickSwitchDock({
  selectedRepoId,
  onSelectRepo,
  position = 'top',
  className,
}: QuickSwitchDockProps) {
  const { repositories, connected, error } = useMultiRepoStream();
  const { getAlertForRepo } = useStuckDetection();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Sort repos by activity/priority for display
  const sortedRepos = useMemo(() => sortByActivityAndPriority(repositories), [repositories]);

  // Filter to only repos with active work (non-idle status or recent activity)
  const activeRepos = useMemo(() => {
    return sortedRepos.filter(repo => {
      // Show if not idle or has had activity in last hour
      if (repo.claudeStatus !== 'idle') return true;
      const hourAgo = Date.now() - 60 * 60 * 1000;
      return new Date(repo.lastActivity).getTime() > hourAgo;
    });
  }, [sortedRepos]);

  // Handle repo selection with zero reload
  const handleSelectRepo = useCallback((repoId: string, sessionId?: string | null) => {
    onSelectRepo?.(repoId, sessionId);
  }, [onSelectRepo]);

  // Keyboard shortcuts (Cmd+1-9 for repo switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + number
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        const repo = activeRepos[index];
        if (repo) {
          e.preventDefault();
          handleSelectRepo(repo.repositoryId, repo.sessionId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRepos, handleSelectRepo]);

  // Don't render if no repos
  if (repositories.length === 0 && !error) {
    return null;
  }

  return (
    <>
      {/* Desktop Dock */}
      <div
        className={cn(
          'hidden md:flex items-center gap-2 px-4 py-2',
          'bg-background/80 backdrop-blur-sm border-b',
          position === 'bottom' && 'border-t border-b-0',
          className
        )}
      >
        {/* Connection Status */}
        <ConnectionIndicator connected={connected} error={error} />

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Repo Pills - Horizontal scrollable */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2">
            {activeRepos.map((repo, index) => (
              <RepoPill
                key={repo.repositoryId}
                repo={repo}
                isSelected={repo.repositoryId === selectedRepoId}
                shortcutNumber={index < 9 ? index + 1 : undefined}
                stuckAlert={getAlertForRepo(repo.repositoryId)}
                onClick={() => handleSelectRepo(repo.repositoryId, repo.sessionId)}
              />
            ))}

            {activeRepos.length === 0 && (
              <span className="text-xs text-muted-foreground py-1">
                No active repositories
              </span>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {activeRepos.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <DockStats repos={activeRepos} />
          </>
        )}
      </div>

      {/* Mobile Tab Bar */}
      <MobileTabBar
        repos={activeRepos}
        selectedRepoId={selectedRepoId}
        onSelectRepo={handleSelectRepo}
        onExpandSheet={() => setMobileSheetOpen(true)}
        connected={connected}
      />

      {/* Mobile Bottom Sheet */}
      <MobileBottomSheet
        repos={sortedRepos}
        selectedRepoId={selectedRepoId}
        onSelectRepo={handleSelectRepo}
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        connected={connected}
      />
    </>
  );
}

/* ============================================
   SUBCOMPONENTS - Dock Stats
   ============================================ */

interface DockStatsProps {
  repos: RepoSessionState[];
}

interface DisplayStats {
  active: number;
  waiting: number;
  stuck: number;
}

function useDisplayStats(repos: RepoSessionState[]): DisplayStats {
  return useMemo(() => {
    // Count stats based on each repo's claudeStatus (which reflects the last task)
    const active = repos.filter(r => ['thinking', 'writing'].includes(r.claudeStatus)).length;
    const waiting = repos.filter(r => r.claudeStatus === 'waiting_input').length;
    const stuck = repos.filter(r => r.claudeStatus === 'stuck').length;

    return { active, waiting, stuck };
  }, [repos]);
}

function StatItem({ show, color, icon, label }: { show: boolean; color: string; icon: React.ReactNode; label: string }) {
  if (!show) return null;
  return <span className={cn('flex items-center gap-1', color)}>{icon}{label}</span>;
}

function DockStats({ repos }: DockStatsProps) {
  const stats = useDisplayStats(repos);

  return (
    <div className="flex items-center gap-3 text-[10px]">
      <StatItem show={stats.active > 0} color="text-emerald-600 dark:text-emerald-400" icon={<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />} label={`${stats.active} active`} />
      <StatItem show={stats.waiting > 0} color="text-amber-600 dark:text-amber-400" icon={<Bell className="h-3 w-3" />} label={`${stats.waiting} waiting`} />
      <StatItem show={stats.stuck > 0} color="text-red-600 dark:text-red-400 font-semibold" icon={<AlertTriangle className="h-3 w-3 animate-pulse" />} label={`${stats.stuck} stuck`} />
    </div>
  );
}

export default QuickSwitchDock;
