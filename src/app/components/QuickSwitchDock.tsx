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
  Zap,
  Clock,
  AlertCircle,
  Circle,
  Pause,
  GitBranch,
  ChevronUp,
  Wifi,
  WifiOff,
  Loader2,
  X,
  Command,
  type LucideIcon,
} from 'lucide-react';

/* ============================================
   TYPES & INTERFACES
   ============================================ */

export interface QuickSwitchDockProps {
  selectedRepoId?: string;
  onSelectRepo?: (repositoryId: string, sessionId?: string | null) => void;
  position?: 'top' | 'bottom';
  className?: string;
}

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  ringColor: string;
  animate?: 'pulse' | 'slow-pulse' | 'alert';
  priority: number;
}

/* ============================================
   STATUS CONFIGURATION
   Mapping: green=active, yellow=waiting, red=stuck, gray=idle
   ============================================ */

const STATUS_CONFIGS: Record<ClaudeStatus, StatusConfig> = {
  writing: {
    icon: Zap,
    label: 'Active',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    ringColor: 'ring-green-500/50',
    animate: 'pulse',
    priority: 0,
  },
  thinking: {
    icon: Zap,
    label: 'Active',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    ringColor: 'ring-green-500/50',
    animate: 'pulse',
    priority: 1,
  },
  waiting_input: {
    icon: Clock,
    label: 'Waiting',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
    ringColor: 'ring-yellow-500/50',
    animate: 'slow-pulse',
    priority: 2,
  },
  stuck: {
    icon: AlertCircle,
    label: 'Stuck',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    ringColor: 'ring-red-500/50',
    animate: 'alert',
    priority: 3,
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    color: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
    ringColor: 'ring-gray-400/50',
    priority: 4,
  },
  idle: {
    icon: Circle,
    label: 'Idle',
    color: 'text-gray-400 dark:text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800',
    dotColor: 'bg-gray-300 dark:bg-gray-600',
    ringColor: 'ring-gray-300/50',
    priority: 5,
  },
};

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

function sortByActivityAndPriority(repos: RepoSessionState[]): RepoSessionState[] {
  return [...repos].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    const priorityDiff = STATUS_CONFIGS[a.claudeStatus].priority - STATUS_CONFIGS[b.claudeStatus].priority;
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

function getShortName(name: string): string {
  if (name.length <= 14) return name;
  const parts = name.split(/[-_./]/);
  if (parts.length > 1 && parts[0]) {
    return parts[0].length <= 12 ? parts[0] : parts[0].substring(0, 10) + '…';
  }
  return name.substring(0, 12) + '…';
}

function getAnimationClass(animate?: 'pulse' | 'slow-pulse' | 'alert'): string {
  switch (animate) {
    case 'pulse': return 'animate-pulse-fast';
    case 'slow-pulse': return 'animate-pulse-slow';
    case 'alert': return 'animate-pulse-alert';
    default: return '';
  }
}

function formatStuckTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function getPingDuration(animate?: 'pulse' | 'slow-pulse' | 'alert'): string {
  if (animate === 'slow-pulse') return '2s';
  if (animate === 'alert') return '0.8s';
  return '1.5s';
}

/* ============================================
   STATUS DOT COMPONENT
   ============================================ */

interface StatusDotProps {
  status: ClaudeStatus;
  size?: 'sm' | 'md' | 'lg';
  showPing?: boolean;
}

const SIZE_CLASSES = { sm: 'h-1.5 w-1.5', md: 'h-2 w-2', lg: 'h-2.5 w-2.5' };

function StatusDot({ status, size = 'md', showPing = true }: StatusDotProps) {
  const config = STATUS_CONFIGS[status];
  return (
    <span className="relative inline-flex">
      <span className={cn(SIZE_CLASSES[size], 'rounded-full', config.dotColor, config.animate && getAnimationClass(config.animate))} />
      {showPing && config.animate && (
        <span className={cn('absolute inset-0 rounded-full opacity-40', config.dotColor, 'animate-ping')} style={{ animationDuration: getPingDuration(config.animate) }} />
      )}
    </span>
  );
}

/* ============================================
   CONNECTION STATUS INDICATOR
   ============================================ */

interface ConnectionIndicatorProps {
  connected: boolean;
  error?: string | null;
  compact?: boolean;
}

function ConnectionIndicatorConnected({ compact }: { compact: boolean }) {
  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'text-[10px]' : 'text-xs', 'text-green-600 dark:text-green-400')}>
      <Wifi className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {!compact && <span className="font-medium">Live</span>}
    </div>
  );
}

function ConnectionIndicatorError({ compact }: { compact: boolean }) {
  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'text-[10px]' : 'text-xs', 'text-red-500 dark:text-red-400')}>
      <WifiOff className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {!compact && <span className="font-medium">Offline</span>}
    </div>
  );
}

function ConnectionIndicatorConnecting({ compact }: { compact: boolean }) {
  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'text-[10px]' : 'text-xs', 'text-gray-400')}>
      <Loader2 className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', 'animate-spin')} />
      {!compact && <span className="font-medium">Connecting</span>}
    </div>
  );
}

function ConnectionIndicator({ connected, error, compact = false }: ConnectionIndicatorProps) {
  if (connected) return <ConnectionIndicatorConnected compact={compact} />;
  if (error) return <ConnectionIndicatorError compact={compact} />;
  return <ConnectionIndicatorConnecting compact={compact} />;
}

/* ============================================
   LIVE STUCK DURATION HOOK
   ============================================ */

function useLiveStuckDuration(stuckAlert: StuckAlert | null | undefined): number {
  const alertId = stuckAlert?.id;
  const initialDuration = stuckAlert?.stuckDurationSeconds ?? 0;
  const [liveDuration, setLiveDuration] = useState(initialDuration);

  useEffect(() => {
    if (!alertId) { setLiveDuration(0); return; }
    setLiveDuration(initialDuration);
    const interval = setInterval(() => setLiveDuration(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [alertId, initialDuration]);

  return alertId ? liveDuration : 0;
}

/* ============================================
   REPO CHIP COMPONENT (Desktop)
   ============================================ */

interface RepoChipProps {
  repo: RepoSessionState;
  isSelected: boolean;
  shortcutNumber?: number;
  stuckAlert?: StuckAlert | null;
  onClick: () => void;
}

function RepoChip({ repo, isSelected, shortcutNumber, stuckAlert, onClick }: RepoChipProps) {
  const config = STATUS_CONFIGS[repo.claudeStatus];
  const shortName = getShortName(repo.repositoryName);
  const hasStuckAlert = Boolean(stuckAlert && !stuckAlert.acknowledged);
  const liveDuration = useLiveStuckDuration(stuckAlert);

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-1.5 rounded-full border',
        'transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
        config.bgColor,
        isSelected && !hasStuckAlert && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
        hasStuckAlert && 'ring-2 ring-red-500 ring-offset-1 ring-offset-background animate-pulse'
      )}
      title={`${repo.repositoryName} - ${config.label}${shortcutNumber ? ` (⌘${shortcutNumber})` : ''}`}
    >
      <GitBranch className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
      <span className={cn('text-xs font-medium truncate max-w-[100px]', config.color)}>{shortName}</span>
      <StatusDot status={repo.claudeStatus} size="sm" />
      {hasStuckAlert && (
        <>
          <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold shadow-sm">!</span>
          {liveDuration > 0 && <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-mono shadow-sm">{formatStuckTime(liveDuration)}</span>}
        </>
      )}
      {shortcutNumber && !hasStuckAlert && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-mono shadow-md">
          <Command className="h-2.5 w-2.5" />{shortcutNumber}
        </span>
      )}
    </button>
  );
}

/* ============================================
   DOCK STATS COMPONENT
   ============================================ */

interface DockStatsProps { repos: RepoSessionState[] }

function DockStats({ repos }: DockStatsProps) {
  const stats = useMemo(() => ({
    active: repos.filter(r => ['thinking', 'writing'].includes(r.claudeStatus)).length,
    waiting: repos.filter(r => r.claudeStatus === 'waiting_input').length,
    stuck: repos.filter(r => r.claudeStatus === 'stuck').length,
  }), [repos]);

  if (stats.active === 0 && stats.waiting === 0 && stats.stuck === 0) return null;

  return (
    <div className="flex items-center gap-3 text-[11px] font-medium">
      {stats.active > 0 && <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><StatusDot status="writing" size="sm" /><span>{stats.active}</span></div>}
      {stats.waiting > 0 && <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400"><StatusDot status="waiting_input" size="sm" /><span>{stats.waiting}</span></div>}
      {stats.stuck > 0 && <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold"><StatusDot status="stuck" size="sm" /><span>{stats.stuck}</span></div>}
    </div>
  );
}

/* ============================================
   MOBILE TAB ITEM COMPONENT
   ============================================ */

interface MobileTabItemProps {
  repo: RepoSessionState;
  isSelected: boolean;
  hasStuckAlert: boolean;
  onSelect: () => void;
}

function MobileTabItem({ repo, isSelected, hasStuckAlert, onSelect }: MobileTabItemProps) {
  const config = STATUS_CONFIGS[repo.claudeStatus];
  const Icon = config.icon;
  return (
    <button onClick={onSelect} className={cn('flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-colors duration-150 active:bg-gray-100 dark:active:bg-gray-800', isSelected && 'bg-primary/5')}>
      <div className="relative">
        <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : config.color)} />
        <span className={cn('absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full', config.dotColor, config.animate && getAnimationClass(config.animate))} />
        {hasStuckAlert && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 flex items-center justify-center"><span className="text-[8px] text-white font-bold">!</span></span>}
      </div>
      <span className={cn('text-[10px] truncate max-w-[70px]', isSelected ? 'text-primary font-medium' : 'text-muted-foreground')}>{getShortName(repo.repositoryName)}</span>
    </button>
  );
}

/* ============================================
   MOBILE TAB BAR COMPONENT
   ============================================ */

interface MobileTabBarProps {
  repos: RepoSessionState[];
  selectedRepoId?: string;
  stuckAlerts: Map<string, StuckAlert>;
  onSelectRepo: (repoId: string, sessionId?: string | null) => void;
  onExpandSheet: () => void;
  connected: boolean;
}

function MobileTabBar({ repos, selectedRepoId, stuckAlerts, onSelectRepo, onExpandSheet, connected }: MobileTabBarProps) {
  const visibleRepos = repos.slice(0, 4);
  const hasMore = repos.length > 4;
  const hasStuckRepos = repos.some(r => stuckAlerts.has(r.repositoryId));

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-t safe-bottom">
      <div className="flex items-stretch">
        {visibleRepos.map((repo) => (
          <MobileTabItem key={repo.repositoryId} repo={repo} isSelected={repo.repositoryId === selectedRepoId} hasStuckAlert={stuckAlerts.has(repo.repositoryId)} onSelect={() => onSelectRepo(repo.repositoryId, repo.sessionId)} />
        ))}
        <button onClick={onExpandSheet} className="flex flex-col items-center justify-center gap-1 py-2 px-3 transition-colors duration-150 active:bg-gray-100 dark:active:bg-gray-800">
          <div className="relative">
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
            {(!connected || hasStuckRepos) && <span className={cn('absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full', hasStuckRepos ? 'bg-red-500 animate-pulse' : 'bg-yellow-500')} />}
          </div>
          <span className="text-[10px] text-muted-foreground">{hasMore ? `+${repos.length - 4}` : 'All'}</span>
        </button>
      </div>
    </div>
  );
}

/* ============================================
   MOBILE SHEET REPO ITEM COMPONENT
   ============================================ */

interface MobileSheetRepoItemProps {
  repo: RepoSessionState;
  isSelected: boolean;
  stuckAlert?: StuckAlert;
  onSelect: () => void;
}

function MobileSheetRepoItem({ repo, isSelected, stuckAlert, onSelect }: MobileSheetRepoItemProps) {
  const config = STATUS_CONFIGS[repo.claudeStatus];
  const Icon = config.icon;
  const hasStuckAlert = Boolean(stuckAlert && !stuckAlert.acknowledged);

  return (
    <button onClick={onSelect} className={cn('flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 active:scale-[0.98]', config.bgColor, isSelected && 'ring-2 ring-primary', hasStuckAlert && 'ring-2 ring-red-500 animate-pulse')}>
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg border', config.bgColor, config.color)}><Icon className="h-5 w-5" /></div>
      <div className="flex-1 min-w-0 text-left">
        <p className={cn('text-sm font-medium truncate', config.color)}>{repo.repositoryName}</p>
        <div className="flex items-center gap-1.5 mt-0.5"><StatusDot status={repo.claudeStatus} size="sm" /><span className="text-[10px] text-muted-foreground">{config.label}</span></div>
      </div>
      {hasStuckAlert && <span className="flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold">!</span>}
    </button>
  );
}

/* ============================================
   MOBILE BOTTOM SHEET COMPONENT
   ============================================ */

interface MobileBottomSheetProps {
  repos: RepoSessionState[];
  selectedRepoId?: string;
  stuckAlerts: Map<string, StuckAlert>;
  onSelectRepo: (repoId: string, sessionId?: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
  connected: boolean;
}

function useDragToClose(onClose: () => void) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startTime = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) { startY.current = touch.clientY; startTime.current = Date.now(); setIsDragging(true); }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    if (touch) setDragY(Math.max(0, touch.clientY - startY.current));
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const velocity = dragY / (Date.now() - startTime.current);
    if (dragY > 100 || velocity > 0.5) onClose();
    setDragY(0);
  }, [dragY, onClose]);

  return { dragY, isDragging, handleTouchStart, handleTouchMove, handleTouchEnd };
}

function useSwipeNavigation(repos: RepoSessionState[], selectedRepoId: string | undefined, onSelectRepo: (repoId: string, sessionId?: string | null) => void) {
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const selectedIndex = repos.findIndex(r => r.repositoryId === selectedRepoId);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => { setSwipeStartX(e.touches[0]?.clientX ?? null); }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (swipeStartX === null) return;
    const endX = e.changedTouches[0]?.clientX ?? swipeStartX;
    const diff = endX - swipeStartX;
    if (Math.abs(diff) > 50) {
      const newIndex = diff > 0 ? Math.max(0, selectedIndex - 1) : Math.min(repos.length - 1, selectedIndex + 1);
      if (newIndex !== selectedIndex && repos[newIndex]) onSelectRepo(repos[newIndex].repositoryId, repos[newIndex].sessionId);
    }
    setSwipeStartX(null);
  }, [swipeStartX, selectedIndex, repos, onSelectRepo]);

  return { handleSwipeStart, handleSwipeEnd };
}

function MobileBottomSheet({ repos, selectedRepoId, stuckAlerts, onSelectRepo, isOpen, onClose, connected }: MobileBottomSheetProps) {
  const { dragY, isDragging, handleTouchStart, handleTouchMove, handleTouchEnd } = useDragToClose(onClose);
  const { handleSwipeStart, handleSwipeEnd } = useSwipeNavigation(repos, selectedRepoId, onSelectRepo);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      <div className={cn('fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background rounded-t-2xl shadow-xl transform transition-transform duration-200 ease-out', isDragging && 'transition-none')} style={{ transform: `translateY(${dragY}px)` }} onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-pan-y" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3"><h3 className="text-sm font-semibold">Switch Repository</h3><ConnectionIndicator connected={connected} compact /></div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full"><X className="h-4 w-4" /></Button>
        </div>
        <div className="px-4 py-2 text-[10px] text-center text-muted-foreground">Swipe left/right to switch repos</div>
        <div className="px-4 pb-6 safe-bottom max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {repos.map((repo) => <MobileSheetRepoItem key={repo.repositoryId} repo={repo} isSelected={repo.repositoryId === selectedRepoId} stuckAlert={stuckAlerts.get(repo.repositoryId)} onSelect={() => { onSelectRepo(repo.repositoryId, repo.sessionId); onClose(); }} />)}
          </div>
          {repos.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No repositories with active work</div>}
        </div>
      </div>
    </>
  );
}

/* ============================================
   KEYBOARD SHORTCUT HOOK
   ============================================ */

function useKeyboardShortcuts(activeRepos: RepoSessionState[], handleSelectRepo: (repoId: string, sessionId?: string | null) => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1;
        const repo = activeRepos[index];
        if (repo) { e.preventDefault(); handleSelectRepo(repo.repositoryId, repo.sessionId); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRepos, handleSelectRepo]);
}

/* ============================================
   DESKTOP DOCK COMPONENT
   ============================================ */

interface DesktopDockProps {
  activeRepos: RepoSessionState[];
  selectedRepoId?: string;
  connected: boolean;
  error?: string | null;
  position: 'top' | 'bottom';
  className?: string;
  getAlertForRepo: (repoId: string) => StuckAlert | null;
  onSelectRepo: (repoId: string, sessionId?: string | null) => void;
}

function DesktopDock({ activeRepos, selectedRepoId, connected, error, position, className, getAlertForRepo, onSelectRepo }: DesktopDockProps) {
  return (
    <div className={cn('hidden md:flex items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur-sm', position === 'top' ? 'border-b' : 'border-t', className)}>
      <ConnectionIndicator connected={connected} error={error} />
      <div className="h-4 w-px bg-border" />
      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2">
          {activeRepos.map((repo, index) => (
            <RepoChip key={repo.repositoryId} repo={repo} isSelected={repo.repositoryId === selectedRepoId} shortcutNumber={index < 9 ? index + 1 : undefined} stuckAlert={getAlertForRepo(repo.repositoryId)} onClick={() => onSelectRepo(repo.repositoryId, repo.sessionId)} />
          ))}
          {activeRepos.length === 0 && <span className="text-xs text-muted-foreground py-1.5">No active repositories</span>}
        </div>
      </div>
      {activeRepos.length > 0 && <><div className="h-4 w-px bg-border" /><DockStats repos={activeRepos} /></>}
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function QuickSwitchDock({ selectedRepoId, onSelectRepo, position = 'top', className }: QuickSwitchDockProps) {
  const { repositories, connected, error } = useMultiRepoStream();
  const { status, getAlertForRepo } = useStuckDetection();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const stuckAlertsMap = useMemo(() => {
    const map = new Map<string, StuckAlert>();
    status?.alerts.forEach(alert => { if (!alert.acknowledged) map.set(alert.repositoryId, alert); });
    return map;
  }, [status?.alerts]);

  const sortedRepos = useMemo(() => sortByActivityAndPriority(repositories), [repositories]);

  const activeRepos = useMemo(() => sortedRepos.filter(repo => {
    if (repo.claudeStatus !== 'idle') return true;
    return new Date(repo.lastActivity).getTime() > Date.now() - 60 * 60 * 1000;
  }), [sortedRepos]);

  const handleSelectRepo = useCallback((repoId: string, sessionId?: string | null) => { onSelectRepo?.(repoId, sessionId); }, [onSelectRepo]);

  useKeyboardShortcuts(activeRepos, handleSelectRepo);

  if (repositories.length === 0 && !error) return null;

  return (
    <>
      <DesktopDock activeRepos={activeRepos} selectedRepoId={selectedRepoId} connected={connected} error={error} position={position} className={className} getAlertForRepo={getAlertForRepo} onSelectRepo={handleSelectRepo} />
      <MobileTabBar repos={activeRepos} selectedRepoId={selectedRepoId} stuckAlerts={stuckAlertsMap} onSelectRepo={handleSelectRepo} onExpandSheet={() => setMobileSheetOpen(true)} connected={connected} />
      <MobileBottomSheet repos={sortedRepos} selectedRepoId={selectedRepoId} stuckAlerts={stuckAlertsMap} onSelectRepo={handleSelectRepo} isOpen={mobileSheetOpen} onClose={() => setMobileSheetOpen(false)} connected={connected} />
    </>
  );
}

export default QuickSwitchDock;
