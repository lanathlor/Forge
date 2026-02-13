'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Repository } from '@/db/schema';
import { useRepositoryData } from '../hooks/useRepositoryData';
import {
  useMultiRepoStream,
  type RepoSessionState,
  type ClaudeStatus,
} from '@/shared/hooks/useMultiRepoStream';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import { cn } from '@/shared/lib/utils';
import { Card } from '@/shared/components/ui/card';
import {
  Search,
  Zap,
  Clock,
  AlertTriangle,
  Circle,
  Pause,
  GitBranch,
  ChevronRight,
  Command,
  RefreshCw,
  Activity,
  type LucideIcon,
} from 'lucide-react';

/* ============================================
   TYPES & CONFIG
   ============================================ */

interface RepositorySelectorProps {
  onSelect?: (repository: Repository) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  textColor: string;
  bgColor: string;
  dotColor: string;
  borderColor: string;
  animation: 'pulse-active' | 'pulse-waiting' | 'pulse-alert' | 'none';
  priority: number;
}

const STATUS_CONFIG: Record<ClaudeStatus, StatusConfig> = {
  writing: {
    icon: Zap, label: 'Writing', shortLabel: 'Active',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    animation: 'pulse-active', priority: 0,
  },
  thinking: {
    icon: Zap, label: 'Thinking', shortLabel: 'Active',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    animation: 'pulse-active', priority: 1,
  },
  waiting_input: {
    icon: Clock, label: 'Waiting', shortLabel: 'Waiting',
    textColor: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    dotColor: 'bg-amber-500',
    borderColor: 'border-amber-300 dark:border-amber-700',
    animation: 'pulse-waiting', priority: 2,
  },
  stuck: {
    icon: AlertTriangle, label: 'Stuck', shortLabel: 'Stuck',
    textColor: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    dotColor: 'bg-red-500',
    borderColor: 'border-red-400 dark:border-red-700',
    animation: 'pulse-alert', priority: 3,
  },
  paused: {
    icon: Pause, label: 'Paused', shortLabel: 'Paused',
    textColor: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    dotColor: 'bg-slate-400',
    borderColor: 'border-slate-300 dark:border-slate-700',
    animation: 'none', priority: 4,
  },
  idle: {
    icon: Circle, label: 'Idle', shortLabel: 'Idle',
    textColor: 'text-slate-500 dark:text-slate-500',
    bgColor: 'bg-slate-50/50 dark:bg-slate-900/20',
    dotColor: 'bg-slate-300 dark:bg-slate-600',
    borderColor: 'border-slate-200 dark:border-slate-800',
    animation: 'none', priority: 5,
  },
};

/* ============================================
   FUZZY FILTER
   ============================================ */

function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return { match: true, score: 0 };

  // Exact substring match gets highest score
  if (lower.includes(q)) return { match: true, score: 100 - lower.indexOf(q) };

  // Fuzzy character-by-character match
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -1;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      score += 10;
      if (lastMatchIdx === i - 1) score += 5;
      if (i === 0 || lower[i - 1] === '/' || lower[i - 1] === '-' || lower[i - 1] === '_') score += 8;
      lastMatchIdx = i;
      qi++;
    }
  }
  return { match: qi === q.length, score };
}

/* ============================================
   STATUS DOT
   ============================================ */

function getAnimClass(animation: StatusConfig['animation']): string {
  if (animation === 'pulse-active') return 'animate-pulse-fast';
  if (animation === 'pulse-waiting') return 'animate-pulse-slow';
  if (animation === 'pulse-alert') return 'animate-pulse-alert';
  return '';
}

function StatusDot({ status, size = 'sm' }: { status: ClaudeStatus; size?: 'xs' | 'sm' }) {
  const c = STATUS_CONFIG[status];
  const sz = size === 'xs' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return (
    <span className="relative inline-flex shrink-0">
      <span className={cn(sz, 'rounded-full', c.dotColor, getAnimClass(c.animation))} />
      {c.animation !== 'none' && (
        <span
          className={cn('absolute inset-0 rounded-full opacity-40 animate-ping', c.dotColor)}
          style={{ animationDuration: c.animation === 'pulse-active' ? '1.5s' : '2s' }}
        />
      )}
    </span>
  );
}

/* ============================================
   REPO ROW - Active Work
   ============================================ */

interface ActiveRepoRowProps {
  repo: Repository;
  liveState: RepoSessionState | undefined;
  isSelected: boolean;
  isFocused: boolean;
  shortcutNum?: number;
  needsAttention: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function ActiveRepoRow({
  repo,
  liveState,
  isSelected,
  isFocused,
  shortcutNum,
  needsAttention,
  onSelect,
  onMouseEnter,
}: ActiveRepoRowProps) {
  const status = liveState?.claudeStatus ?? 'idle';
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  const taskCount = liveState?.currentTask ? 1 : 0;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      data-repo-id={repo.id}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-100',
        'hover:bg-muted/60 active:scale-[0.99]',
        'focus:outline-none',
        isFocused && 'bg-muted/80 ring-1 ring-primary/30',
        isSelected && !isFocused && 'bg-primary/8 border-l-2 border-l-primary',
        needsAttention && 'ring-1 ring-red-400/50',
      )}
    >
      {/* Status indicator */}
      <div className={cn('flex items-center justify-center h-7 w-7 rounded-md shrink-0', c.bgColor)}>
        <Icon className={cn('h-3.5 w-3.5', c.textColor)} />
      </div>

      {/* Repo info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{repo.name}</span>
          {needsAttention && (
            <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              !
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusDot status={status} size="xs" />
          <span className={cn('text-[11px]', c.textColor)}>{c.label}</span>
          {taskCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              &middot; {taskCount} task
            </span>
          )}
        </div>
      </div>

      {/* Right side: shortcut hint or chevron */}
      <div className="flex items-center gap-1 shrink-0">
        {shortcutNum && shortcutNum <= 9 && (
          <span className="hidden group-hover/selector:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
            <Command className="h-2.5 w-2.5" />{shortcutNum}
          </span>
        )}
        {isFocused && !isSelected && (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
    </button>
  );
}

/* ============================================
   REPO ROW - All Repositories
   ============================================ */

interface RepoRowProps {
  repo: Repository;
  liveState: RepoSessionState | undefined;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function RepoRow({
  repo,
  liveState,
  isSelected,
  isFocused,
  onSelect,
  onMouseEnter,
}: RepoRowProps) {
  const hasSession = liveState && liveState.claudeStatus !== 'idle';

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      data-repo-id={repo.id}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all duration-100',
        'hover:bg-muted/60 active:scale-[0.99]',
        'focus:outline-none',
        isFocused && 'bg-muted/80 ring-1 ring-primary/30',
        isSelected && !isFocused && 'bg-primary/8',
      )}
    >
      <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm truncate flex-1">{repo.name}</span>
      {hasSession && <StatusDot status={liveState.claudeStatus} size="xs" />}
      {isSelected && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      )}
      {isFocused && !isSelected && (
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

/* ============================================
   SECTION HEADER
   ============================================ */

function SectionHeader({ title, count, icon: Icon }: { title: string; count: number; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      <span className="text-[10px] text-muted-foreground/60">{count}</span>
    </div>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function RepositorySelector({
  onSelect,
  isCollapsed = false,
  onToggleCollapse,
}: RepositorySelectorProps) {
  const data = useRepositoryData(onSelect);
  const { repositories, isLoading, error, handleRescan, isRescanning, selected } = data;
  const { repositories: liveRepos } = useMultiRepoStream();
  const { getAlertForRepo } = useStuckDetection();

  const [searchQuery, setSearchQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(-1);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);

  // Use either locally-tracked selection or auto-selected from hook
  const currentSelectedId = localSelectedId ?? selected?.id ?? null;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cache lookup: repo -> live state
  const liveStateMap = useMemo(() => {
    const map = new Map<string, RepoSessionState>();
    for (const lr of liveRepos) {
      map.set(lr.repositoryId, lr);
    }
    return map;
  }, [liveRepos]);

  // Split repos into active (has running session, non-idle) and all, sorted
  const { activeRepos, allRepos } = useMemo(() => {
    const active: Repository[] = [];
    const all: Repository[] = [];

    for (const repo of repositories) {
      const live = liveStateMap.get(repo.id);
      if (live && live.claudeStatus !== 'idle') {
        active.push(repo);
      }
      all.push(repo);
    }

    // Sort active by priority (stuck first, then by activity)
    active.sort((a, b) => {
      const la = liveStateMap.get(a.id);
      const lb = liveStateMap.get(b.id);
      if (!la || !lb) return 0;
      if (la.needsAttention !== lb.needsAttention) return la.needsAttention ? -1 : 1;
      const diff = STATUS_CONFIG[la.claudeStatus].priority - STATUS_CONFIG[lb.claudeStatus].priority;
      if (diff !== 0) return diff;
      return new Date(lb.lastActivity).getTime() - new Date(la.lastActivity).getTime();
    });

    // Sort all alphabetically
    all.sort((a, b) => a.name.localeCompare(b.name));

    return { activeRepos: active, allRepos: all };
  }, [repositories, liveStateMap]);

  // Filter by search query with fuzzy matching
  const filteredItems = useMemo((): { active: Repository[]; all: Repository[] } => {
    if (!searchQuery.trim()) {
      return {
        active: activeRepos,
        all: allRepos.filter(r => !activeRepos.find(ar => ar.id === r.id)),
      };
    }

    const scored = repositories.map((repo: Repository) => {
      const nameMatch = fuzzyMatch(repo.name, searchQuery);
      const pathMatch = fuzzyMatch(repo.path, searchQuery);
      const branchMatch = fuzzyMatch(repo.currentBranch || '', searchQuery);
      const bestScore = Math.max(nameMatch.score, pathMatch.score, branchMatch.score);
      const matches = nameMatch.match || pathMatch.match || branchMatch.match;
      return { repo, score: bestScore, matches };
    })
      .filter((s: { matches: boolean }) => s.matches)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    const activeIds = new Set(activeRepos.map(r => r.id));
    const filteredActive: Repository[] = scored.filter((s: { repo: Repository }) => activeIds.has(s.repo.id)).map((s: { repo: Repository }) => s.repo);
    const filteredAll: Repository[] = scored.filter((s: { repo: Repository }) => !activeIds.has(s.repo.id)).map((s: { repo: Repository }) => s.repo);

    return { active: filteredActive, all: filteredAll };
  }, [searchQuery, activeRepos, allRepos, repositories]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    return [...filteredItems.active, ...filteredItems.all];
  }, [filteredItems]);

  // Track currently selected repo
  const handleSelect = useCallback((repo: Repository) => {
    setLocalSelectedId(repo.id);
    onSelect?.(repo);
  }, [onSelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = flatList.length;
    if (count === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusIndex(prev => (prev + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusIndex(prev => (prev <= 0 ? count - 1 : prev - 1));
        break;
      case 'Enter': {
        e.preventDefault();
        const idx = focusIndex >= 0 && focusIndex < count ? focusIndex : 0;
        const repo = flatList[idx];
        if (repo) handleSelect(repo);
        break;
      }
      case 'Escape':
        e.preventDefault();
        if (searchQuery) {
          setSearchQuery('');
          setFocusIndex(-1);
        } else {
          searchInputRef.current?.blur();
        }
        break;
    }
  }, [flatList, focusIndex, searchQuery, handleSelect]);

  // Reset focus when search changes
  useEffect(() => {
    setFocusIndex(searchQuery ? 0 : -1);
  }, [searchQuery]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex < 0 || !listRef.current) return;
    const repo = flatList[focusIndex];
    if (!repo) return;
    const el = listRef.current.querySelector(`[data-repo-id="${repo.id}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusIndex, flatList]);

  // Global Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Global Cmd+1-9 shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        const combinedTop = [...activeRepos, ...allRepos.filter(r => !activeRepos.find(ar => ar.id === r.id))];
        const repo = combinedTop[idx];
        if (repo) {
          e.preventDefault();
          handleSelect(repo);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeRepos, allRepos, handleSelect]);

  // Collapsed view
  if (isCollapsed) {
    return (
      <Card className="h-full flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
          title="Expand repository selector"
        >
          <GitBranch className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-[10px] font-medium text-muted-foreground [writing-mode:vertical-lr]">
          {repositories.length} repos
        </span>
        {activeRepos.length > 0 && (
          <div className="flex flex-col items-center gap-1 mt-1">
            {activeRepos.slice(0, 5).map(repo => {
              const live = liveStateMap.get(repo.id);
              return (
                <button
                  key={repo.id}
                  onClick={() => handleSelect(repo)}
                  title={`${repo.name} - ${live ? STATUS_CONFIG[live.claudeStatus].label : 'Idle'}`}
                  className="p-1 rounded hover:bg-muted/60 transition-colors"
                >
                  <StatusDot status={live?.claudeStatus ?? 'idle'} />
                </button>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading repositories...</span>
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full flex flex-col items-center justify-center gap-3 p-4">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <span className="text-sm text-muted-foreground">Failed to load</span>
        <button
          onClick={handleRescan}
          disabled={isRescanning}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isRescanning ? 'Scanning...' : 'Retry'}
        </button>
      </Card>
    );
  }

  // Empty state
  if (repositories.length === 0) {
    return (
      <Card className="h-full flex flex-col items-center justify-center gap-3 p-4">
        <GitBranch className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No repositories found</span>
        <button
          onClick={handleRescan}
          disabled={isRescanning}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isRescanning ? 'Scanning...' : 'Scan for repos'}
        </button>
      </Card>
    );
  }

  return (
    <Card className="group/selector h-full flex flex-col overflow-hidden">
      {/* Header with search */}
      <div className="flex-shrink-0 p-2 border-b border-border/50">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs font-semibold text-foreground">Repositories</span>
          <span className="text-[10px] text-muted-foreground">{repositories.length}</span>
          <div className="flex-1" />
          <button
            onClick={handleRescan}
            disabled={isRescanning}
            title="Rescan repositories"
            className="p-1 rounded hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', isRescanning && 'animate-spin')} />
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Collapse panel"
              className="p-1 rounded hover:bg-muted/60 transition-colors"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground rotate-180" />
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search repos..."
            className={cn(
              'w-full h-8 pl-8 pr-12 rounded-md border text-sm',
              'bg-muted/30 border-border/50',
              'placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40',
              'transition-all duration-150',
            )}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border/50">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {/* Repo list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-1.5">
        {/* Active Work section */}
        {filteredItems.active.length > 0 && (
          <div className="mb-2">
            <SectionHeader title="Active Work" count={filteredItems.active.length} icon={Activity} />
            <div className="flex flex-col gap-0.5">
              {filteredItems.active.map((repo, i) => {
                const live = liveStateMap.get(repo.id);
                const alert = getAlertForRepo(repo.id);
                return (
                  <ActiveRepoRow
                    key={repo.id}
                    repo={repo}
                    liveState={live}
                    isSelected={currentSelectedId === repo.id}
                    isFocused={focusIndex === i}
                    shortcutNum={i + 1}
                    needsAttention={Boolean(alert && !alert.acknowledged)}
                    onSelect={() => handleSelect(repo)}
                    onMouseEnter={() => setFocusIndex(i)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* All Repositories section */}
        {filteredItems.all.length > 0 && (
          <div>
            <SectionHeader title="All Repositories" count={filteredItems.all.length} icon={GitBranch} />
            <div className="flex flex-col gap-0.5">
              {filteredItems.all.map((repo, j) => {
                const globalIdx = filteredItems.active.length + j;
                const live = liveStateMap.get(repo.id);
                return (
                  <RepoRow
                    key={repo.id}
                    repo={repo}
                    liveState={live}
                    isSelected={currentSelectedId === repo.id}
                    isFocused={focusIndex === globalIdx}
                    onSelect={() => handleSelect(repo)}
                    onMouseEnter={() => setFocusIndex(globalIdx)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* No results */}
        {flatList.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-5 w-5 text-muted-foreground/40 mb-2" />
            <span className="text-sm text-muted-foreground">No repos match &quot;{searchQuery}&quot;</span>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
