'use client';

import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
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
  AlertTriangle,
  Circle,
  Pause,
  GitBranch,
  ChevronUp,
  Wifi,
  WifiOff,
  Loader2,
  X,
  Command,
  MoreHorizontal,
  Activity,
  type LucideIcon,
} from 'lucide-react';

/* ============================================
   TYPES & CONFIGURATION
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
  shortLabel: string;
  textColor: string;
  bgColor: string;
  dotColor: string;
  borderColor: string;
  animation: 'pulse-active' | 'pulse-waiting' | 'pulse-alert' | 'none';
  priority: number;
}

interface SeverityStyle {
  ring: string;
  badge: string;
  glow: string;
}

const STATUS_CONFIG: Record<ClaudeStatus, StatusConfig> = {
  writing: {
    icon: Zap,
    label: 'Active - Writing',
    shortLabel: 'Active',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    animation: 'pulse-active',
    priority: 0,
  },
  thinking: {
    icon: Zap,
    label: 'Active - Thinking',
    shortLabel: 'Active',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-300 dark:border-emerald-700',
    animation: 'pulse-active',
    priority: 1,
  },
  waiting_input: {
    icon: Clock,
    label: 'Waiting for Input',
    shortLabel: 'Waiting',
    textColor: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    dotColor: 'bg-amber-500',
    borderColor: 'border-amber-300 dark:border-amber-700',
    animation: 'pulse-waiting',
    priority: 2,
  },
  stuck: {
    icon: AlertTriangle,
    label: 'Needs Attention',
    shortLabel: 'Stuck',
    textColor: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    dotColor: 'bg-red-500',
    borderColor: 'border-red-400 dark:border-red-700',
    animation: 'pulse-alert',
    priority: 3,
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    shortLabel: 'Paused',
    textColor: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-900/40',
    dotColor: 'bg-slate-400',
    borderColor: 'border-slate-300 dark:border-slate-700',
    animation: 'none',
    priority: 4,
  },
  idle: {
    icon: Circle,
    label: 'Idle',
    shortLabel: 'Idle',
    textColor: 'text-slate-500 dark:text-slate-500',
    bgColor: 'bg-slate-50/50 dark:bg-slate-900/20',
    dotColor: 'bg-slate-300 dark:bg-slate-600',
    borderColor: 'border-slate-200 dark:border-slate-800',
    animation: 'none',
    priority: 5,
  },
};

const SEVERITY_STYLES: Record<string, SeverityStyle> = {
  critical: {
    ring: 'ring-2 ring-red-500 ring-offset-1 ring-offset-background',
    badge: 'bg-red-600 text-white animate-bounce',
    glow: 'shadow-lg shadow-red-500/40',
  },
  high: {
    ring: 'ring-2 ring-orange-500 ring-offset-1 ring-offset-background',
    badge: 'bg-orange-500 text-white',
    glow: 'shadow-md shadow-orange-500/30',
  },
  medium: {
    ring: 'ring-2 ring-amber-500 ring-offset-1 ring-offset-background',
    badge: 'bg-amber-500 text-white',
    glow: 'shadow-sm shadow-amber-500/20',
  },
  low: {
    ring: 'ring-1 ring-yellow-500',
    badge: 'bg-yellow-500 text-black',
    glow: '',
  },
};

const DEFAULT_SEVERITY: SeverityStyle = {
  ring: 'ring-1 ring-yellow-500',
  badge: 'bg-yellow-500 text-black',
  glow: '',
};

function getSeverity(s: string): SeverityStyle {
  return SEVERITY_STYLES[s] ?? DEFAULT_SEVERITY;
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

function sortReposByPriority(repos: RepoSessionState[]): RepoSessionState[] {
  return [...repos].sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    const diff =
      STATUS_CONFIG[a.claudeStatus].priority -
      STATUS_CONFIG[b.claudeStatus].priority;
    if (diff !== 0) return diff;
    return (
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  });
}

function getShortName(name: string, max = 12): string {
  if (name.length <= max) return name;
  const seg = name.split(/[-_./]/)[0];
  if (seg && seg.length <= max) return seg;
  return name.slice(0, max - 1) + '…';
}

function fmtDuration(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function getAnim(a: StatusConfig['animation']): string {
  if (a === 'pulse-active') return 'animate-pulse-fast';
  if (a === 'pulse-waiting') return 'animate-pulse-slow';
  if (a === 'pulse-alert') return 'animate-pulse-alert';
  return '';
}

/* ============================================
   HOOKS
   ============================================ */

function useLiveStuckDuration(alert: StuckAlert | null | undefined): number {
  const [dur, setDur] = useState(alert?.stuckDurationSeconds ?? 0);
  const id = alert?.id;
  useEffect(() => {
    if (!id) {
      setDur(0);
      return;
    }
    setDur(alert?.stuckDurationSeconds ?? 0);
    const iv = setInterval(() => setDur((d) => d + 1), 1000);
    return () => clearInterval(iv);
  }, [id, alert?.stuckDurationSeconds]);
  return id ? dur : 0;
}

function useKeyboardNav(
  repos: RepoSessionState[],
  onSelect: (id: string, sid?: string | null) => void
) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const repo = repos[parseInt(e.key, 10) - 1];
        if (repo) {
          e.preventDefault();
          onSelect(repo.repositoryId, repo.sessionId);
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [repos, onSelect]);
}

function useSwipe(
  repos: RepoSessionState[],
  selId: string | undefined,
  onSel: (id: string, sid?: string | null) => void
) {
  const start = useRef<{ x: number; t: number } | null>(null);
  const idx = repos.findIndex((r) => r.repositoryId === selId);
  const onStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) start.current = { x: t.clientX, t: Date.now() };
  }, []);
  const onEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.current.x,
        dt = Date.now() - start.current.t;
      if (Math.abs(dx) > 50 || Math.abs(dx) / dt > 0.5) {
        const ni = Math.max(
          0,
          Math.min(repos.length - 1, idx + (dx > 0 ? -1 : 1))
        );
        if (ni !== idx && repos[ni])
          onSel(repos[ni].repositoryId, repos[ni].sessionId);
      }
      start.current = null;
    },
    [repos, idx, onSel]
  );
  return { onTouchStart: onStart, onTouchEnd: onEnd };
}

function useDragClose(onClose: () => void) {
  const [y, setY] = useState(0);
  const [drag, setDrag] = useState(false);
  const sy = useRef(0),
    st = useRef(0);
  const onStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t) {
      sy.current = t.clientY;
      st.current = Date.now();
      setDrag(true);
    }
  }, []);
  const onMove = useCallback(
    (e: React.TouchEvent) => {
      if (!drag) return;
      const t = e.touches[0];
      if (t) setY(Math.max(0, t.clientY - sy.current));
    },
    [drag]
  );
  const onEnd = useCallback(() => {
    if (y > 100 || y / (Date.now() - st.current) > 0.5) onClose();
    setY(0);
    setDrag(false);
  }, [y, onClose]);
  return { y, drag, onStart, onMove, onEnd };
}

/* ============================================
   SMALL COMPONENTS
   ============================================ */

const DOT_SZ = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-2.5 w-2.5' };

function StatusDot({
  status,
  size = 'sm',
  ping = true,
}: {
  status: ClaudeStatus;
  size?: 'xs' | 'sm' | 'md';
  ping?: boolean;
}) {
  const c = STATUS_CONFIG[status];
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          DOT_SZ[size],
          'rounded-full',
          c.dotColor,
          getAnim(c.animation)
        )}
      />
      {ping && c.animation !== 'none' && (
        <span
          className={cn(
            'absolute inset-0 animate-ping rounded-full opacity-40',
            c.dotColor
          )}
          style={{
            animationDuration: c.animation === 'pulse-active' ? '1.5s' : '2s',
          }}
        />
      )}
    </span>
  );
}

function ConnBadge({ conn, err }: { conn: boolean; err?: string | null }) {
  if (conn)
    return (
      <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <Wifi className="h-3 w-3" />
        <span>Live</span>
      </div>
    );
  if (err)
    return (
      <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <WifiOff className="h-3 w-3" />
        <span>Offline</span>
      </div>
    );
  return (
    <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Connecting</span>
    </div>
  );
}

function AlertBadge({ sev }: { sev: SeverityStyle }) {
  return (
    <span
      className={cn(
        'absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold shadow-sm',
        sev.badge
      )}
    >
      !
    </span>
  );
}

function DurationBadge({ dur, crit }: { dur: number; crit: boolean }) {
  if (dur <= 0) return null;
  return (
    <span
      className={cn(
        'absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[9px] font-medium shadow-sm',
        crit
          ? 'bg-red-600 text-white'
          : 'bg-slate-700 text-white dark:bg-slate-600'
      )}
    >
      {fmtDuration(dur)}
    </span>
  );
}

function ShortcutHint({ n }: { n: number }) {
  return (
    <span className="absolute -top-5 left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white shadow-md group-hover:flex dark:bg-slate-100 dark:text-slate-900">
      <Command className="h-2.5 w-2.5" />
      {n}
    </span>
  );
}

/* ============================================
   REPO PILL (Desktop)
   ============================================ */

interface PillProps {
  repo: RepoSessionState;
  sel: boolean;
  num?: number;
  alert?: StuckAlert | null;
  onClick: () => void;
}

function getPillClasses(
  c: StatusConfig,
  sel: boolean,
  hasA: boolean,
  sev: SeverityStyle
): string {
  return cn(
    'group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    c.bgColor,
    c.borderColor,
    sel &&
      !hasA &&
      'ring-2 ring-primary ring-offset-1 ring-offset-background shadow-md',
    hasA && sev.ring,
    hasA && sev.glow,
    hasA && 'animate-pulse-border'
  );
}

function PillContent({
  c,
  name,
  status,
}: {
  c: StatusConfig;
  name: string;
  status: ClaudeStatus;
}) {
  return (
    <>
      <GitBranch className={cn('h-3 w-3 shrink-0', c.textColor)} />
      <span
        className={cn('max-w-[90px] truncate text-xs font-medium', c.textColor)}
      >
        {getShortName(name)}
      </span>
      <StatusDot status={status} size="xs" />
    </>
  );
}

function PillOverlays({
  hasA,
  sev,
  dur,
  crit,
  num,
}: {
  hasA: boolean;
  sev: SeverityStyle;
  dur: number;
  crit: boolean;
  num?: number;
}) {
  return (
    <>
      {hasA && <AlertBadge sev={sev} />}
      {hasA && <DurationBadge dur={dur} crit={crit} />}
      {num && !hasA && <ShortcutHint n={num} />}
    </>
  );
}

function RepoPill({ repo, sel, num, alert, onClick }: PillProps) {
  const c = STATUS_CONFIG[repo.claudeStatus];
  const hasA = Boolean(alert && !alert.acknowledged);
  const dur = useLiveStuckDuration(alert);
  const sev = getSeverity(alert?.severity || 'low');
  return (
    <button
      onClick={onClick}
      className={getPillClasses(c, sel, hasA, sev)}
      title={`${repo.repositoryName} - ${c.label}`}
    >
      <PillContent
        c={c}
        name={repo.repositoryName}
        status={repo.claudeStatus}
      />
      <PillOverlays
        hasA={hasA}
        sev={sev}
        dur={dur}
        crit={alert?.severity === 'critical'}
        num={num}
      />
    </button>
  );
}

/* ============================================
   DOCK SUMMARY
   ============================================ */

function DockSummary({
  repos,
  stuck,
}: {
  repos: RepoSessionState[];
  stuck: number;
}) {
  const act = repos.filter(
    (r) => r.claudeStatus === 'writing' || r.claudeStatus === 'thinking'
  ).length;
  const wait = repos.filter((r) => r.claudeStatus === 'waiting_input').length;
  if (!act && !wait && !stuck) return null;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {act > 0 && (
        <div className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
          <Activity className="h-3 w-3" />
          <span>{act}</span>
        </div>
      )}
      {wait > 0 && (
        <div className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          <span>{wait}</span>
        </div>
      )}
      {stuck > 0 && (
        <div
          className={cn(
            'flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 font-bold text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400',
            'animate-pulse'
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          <span>{stuck}</span>
        </div>
      )}
    </div>
  );
}

/* ============================================
   DESKTOP DOCK
   ============================================ */

interface DeskDockProps {
  repos: RepoSessionState[];
  selId?: string;
  conn: boolean;
  err?: string | null;
  alerts: Map<string, StuckAlert>;
  getAlert: (id: string) => StuckAlert | null;
  onSel: (id: string, sid?: string | null) => void;
  pos: 'top' | 'bottom';
  cls?: string;
}

function DesktopDock({
  repos,
  selId,
  conn,
  err,
  alerts,
  getAlert,
  onSel,
  pos,
  cls,
}: DeskDockProps) {
  return (
    <div
      className={cn(
        'hidden items-center gap-3 bg-background/90 px-4 py-2 backdrop-blur-sm md:flex',
        pos === 'top' ? 'border-b' : 'border-t',
        cls
      )}
    >
      <ConnBadge conn={conn} err={err} />
      <div className="h-4 w-px bg-border" />
      <div className="scrollbar-hide flex-1 overflow-x-auto">
        <div className="flex items-center gap-2 pb-1">
          {repos.length > 0 ? (
            repos.map((r, i) => (
              <RepoPill
                key={r.repositoryId}
                repo={r}
                sel={r.repositoryId === selId}
                num={i < 9 ? i + 1 : undefined}
                alert={getAlert(r.repositoryId)}
                onClick={() => onSel(r.repositoryId, r.sessionId)}
              />
            ))
          ) : (
            <span className="py-1 text-xs text-muted-foreground">
              No active repositories
            </span>
          )}
        </div>
      </div>
      {repos.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <DockSummary repos={repos} stuck={alerts.size} />
        </>
      )}
    </div>
  );
}

/* ============================================
   MOBILE TAB
   ============================================ */

function MobileTab({
  repo,
  sel,
  hasA,
  onSel,
}: {
  repo: RepoSessionState;
  sel: boolean;
  hasA: boolean;
  onSel: () => void;
}) {
  const c = STATUS_CONFIG[repo.claudeStatus];
  const Icon = c.icon;
  return (
    <button
      onClick={onSel}
      className={cn(
        'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors duration-150 active:bg-slate-100 dark:active:bg-slate-800',
        sel && 'bg-primary/5'
      )}
    >
      <div className="relative">
        <Icon className={cn('h-5 w-5', sel ? 'text-primary' : c.textColor)} />
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
            c.dotColor,
            getAnim(c.animation)
          )}
        />
        {hasA && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500">
            <span className="text-[7px] font-bold text-white">!</span>
          </span>
        )}
      </div>
      <span
        className={cn(
          'max-w-[60px] truncate text-[10px]',
          sel ? 'font-medium text-primary' : 'text-muted-foreground'
        )}
      >
        {getShortName(repo.repositoryName, 8)}
      </span>
    </button>
  );
}

/* ============================================
   MOBILE TAB BAR
   ============================================ */

function MobileTabBar({
  repos,
  selId,
  alerts,
  conn,
  onSel,
  onExp,
}: {
  repos: RepoSessionState[];
  selId?: string;
  alerts: Map<string, StuckAlert>;
  conn: boolean;
  onSel: (id: string, sid?: string | null) => void;
  onExp: () => void;
}) {
  const vis = repos.slice(0, 4),
    more = repos.length > 4,
    stuck = alerts.size > 0;
  return (
    <div className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex items-stretch">
        {vis.map((r) => (
          <MobileTab
            key={r.repositoryId}
            repo={r}
            sel={r.repositoryId === selId}
            hasA={alerts.has(r.repositoryId)}
            onSel={() => onSel(r.repositoryId, r.sessionId)}
          />
        ))}
        <button
          onClick={onExp}
          className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-3 py-2 transition-colors active:bg-slate-100 dark:active:bg-slate-800"
        >
          <div className="relative">
            {more ? (
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
            {(stuck || !conn) && (
              <span
                className={cn(
                  'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
                  stuck ? 'animate-pulse bg-red-500' : 'bg-amber-500'
                )}
              />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {more ? `+${repos.length - 4}` : 'All'}
          </span>
        </button>
      </div>
    </div>
  );
}

/* ============================================
   MOBILE SHEET CARD
   ============================================ */

function getCardClasses(
  c: StatusConfig,
  sel: boolean,
  hasA: boolean,
  sev: SeverityStyle
): string {
  return cn(
    'flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 active:scale-[0.98]',
    c.bgColor,
    c.borderColor,
    sel && !hasA && 'ring-2 ring-primary',
    hasA && sev.ring,
    hasA && 'animate-pulse'
  );
}

function CardIcon({ c }: { c: StatusConfig }) {
  const Icon = c.icon;
  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg border',
        c.bgColor,
        c.borderColor
      )}
    >
      <Icon className={cn('h-5 w-5', c.textColor)} />
    </div>
  );
}

function CardInfo({
  c,
  name,
  status,
  hasA,
  dur,
}: {
  c: StatusConfig;
  name: string;
  status: ClaudeStatus;
  hasA: boolean;
  dur: number;
}) {
  return (
    <div className="min-w-0 flex-1 text-left">
      <p className={cn('truncate text-sm font-medium', c.textColor)}>{name}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <StatusDot status={status} size="xs" />
        <span className="text-[10px] text-muted-foreground">
          {c.shortLabel}
        </span>
        {hasA && dur > 0 && (
          <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
            • {fmtDuration(dur)} stuck
          </span>
        )}
      </div>
    </div>
  );
}

function SheetCard({
  repo,
  sel,
  alert,
  onSel,
}: {
  repo: RepoSessionState;
  sel: boolean;
  alert?: StuckAlert;
  onSel: () => void;
}) {
  const c = STATUS_CONFIG[repo.claudeStatus];
  const hasA = Boolean(alert && !alert.acknowledged);
  const sev = getSeverity(alert?.severity || 'low');
  const dur = useLiveStuckDuration(alert);
  return (
    <button onClick={onSel} className={getCardClasses(c, sel, hasA, sev)}>
      <CardIcon c={c} />
      <CardInfo
        c={c}
        name={repo.repositoryName}
        status={repo.claudeStatus}
        hasA={hasA}
        dur={dur}
      />
      {hasA && (
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
            sev.badge
          )}
        >
          !
        </span>
      )}
    </button>
  );
}

/* ============================================
   MOBILE BOTTOM SHEET
   ============================================ */

interface SheetProps {
  repos: RepoSessionState[];
  selId?: string;
  alerts: Map<string, StuckAlert>;
  conn: boolean;
  open: boolean;
  onSel: (id: string, sid?: string | null) => void;
  onClose: () => void;
}

function MobileSheet({
  repos,
  selId,
  alerts,
  conn,
  open,
  onSel,
  onClose,
}: SheetProps) {
  const { y, drag, onStart, onMove, onEnd } = useDragClose(onClose);
  const sw = useSwipe(repos, selId, onSel);
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background shadow-xl transition-transform duration-200 ease-out md:hidden',
          drag && 'transition-none'
        )}
        style={{ transform: `translateY(${y}px)` }}
        onTouchStart={sw.onTouchStart}
        onTouchEnd={sw.onTouchEnd}
      >
        <div
          className="flex cursor-grab touch-pan-y justify-center py-3 active:cursor-grabbing"
          onTouchStart={onStart}
          onTouchMove={onMove}
          onTouchEnd={onEnd}
        >
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="flex items-center justify-between border-b px-4 pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Switch Repository</h3>
            <ConnBadge conn={conn} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 rounded-full p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="px-4 py-1.5 text-center text-[10px] text-muted-foreground">
          Swipe left/right to navigate • Drag down to close
        </div>
        <div className="safe-bottom max-h-[60vh] overflow-y-auto px-4 pb-6">
          <div className="grid grid-cols-1 gap-2">
            {repos.map((r) => (
              <SheetCard
                key={r.repositoryId}
                repo={r}
                sel={r.repositoryId === selId}
                alert={alerts.get(r.repositoryId)}
                onSel={() => {
                  onSel(r.repositoryId, r.sessionId);
                  onClose();
                }}
              />
            ))}
            {repos.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No repositories with active work
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================
   MAIN COMPONENT
   ============================================ */

export function QuickSwitchDock({
  selectedRepoId,
  onSelectRepo,
  position = 'top',
  className,
}: QuickSwitchDockProps) {
  const { repositories, connected, error } = useMultiRepoStream();
  const { status, getAlertForRepo } = useStuckDetection();
  const [sheetOpen, setSheetOpen] = useState(false);

  const alerts = useMemo(() => {
    const m = new Map<string, StuckAlert>();
    status?.alerts.forEach((a) => {
      if (!a.acknowledged) m.set(a.repositoryId, a);
    });
    return m;
  }, [status?.alerts]);

  const sorted = useMemo(
    () => sortReposByPriority(repositories),
    [repositories]
  );
  const active = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return sorted.filter(
      (r) =>
        r.claudeStatus !== 'idle' || new Date(r.lastActivity).getTime() > cutoff
    );
  }, [sorted]);

  const handleSel = useCallback(
    (id: string, sid?: string | null) => {
      onSelectRepo?.(id, sid);
    },
    [onSelectRepo]
  );
  useKeyboardNav(active, handleSel);

  if (repositories.length === 0 && !error) return null;

  return (
    <>
      <DesktopDock
        repos={active}
        selId={selectedRepoId}
        conn={connected}
        err={error}
        alerts={alerts}
        getAlert={getAlertForRepo}
        onSel={handleSel}
        pos={position}
        cls={className}
      />
      <MobileTabBar
        repos={active}
        selId={selectedRepoId}
        alerts={alerts}
        conn={connected}
        onSel={handleSel}
        onExp={() => setSheetOpen(true)}
      />
      <MobileSheet
        repos={sorted}
        selId={selectedRepoId}
        alerts={alerts}
        conn={connected}
        open={sheetOpen}
        onSel={handleSel}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

export default QuickSwitchDock;
