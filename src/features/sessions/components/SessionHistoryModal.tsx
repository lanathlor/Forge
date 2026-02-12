'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, formatDistanceToNow, isWithinInterval, startOfDay, endOfDay, subWeeks, subMonths } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  GitBranch,
  Play,
  Pause,
  Trash2,
  Loader2,
  Search,
  Filter,
  X,
  Copy,
  MoreHorizontal,
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  History,
  AlertTriangle,
} from 'lucide-react';
import {
  useListSessionsQuery,
  useDeleteSessionMutation,
  useResumeSessionMutation,
  useGetSessionSummaryQuery,
} from '../store/sessionsApi';
import type { SessionStatus } from '@/db/schema/sessions';
import type { SessionWithStats } from '../store/sessionsApi';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionHistoryModalProps {
  repositoryId: string;
  repositoryName: string;
  currentSessionId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';
type ViewMode = 'list' | 'compare';

const STATUS_OPTIONS: { value: SessionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'abandoned', label: 'Abandoned' },
];

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
];

const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; color: string }
> = {
  active: {
    label: 'Active',
    variant: 'default',
    icon: <Play className="h-3 w-3" />,
    color: 'text-green-600',
  },
  paused: {
    label: 'Paused',
    variant: 'secondary',
    icon: <Pause className="h-3 w-3" />,
    color: 'text-yellow-600',
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: 'text-blue-600',
  },
  abandoned: {
    label: 'Abandoned',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
    color: 'text-red-600',
  },
};

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function matchesSearch(s: SessionWithStats, query: string): boolean {
  return (
    s.id.toLowerCase().includes(query) ||
    (s.startBranch?.toLowerCase().includes(query) ?? false) ||
    (s.endBranch?.toLowerCase().includes(query) ?? false)
  );
}

function filterSessions(sessions: SessionWithStats[], searchQuery: string, dateRange: DateRange): SessionWithStats[] {
  let result = sessions;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((s) => matchesSearch(s, q));
  }

  const interval = getDateRangeInterval(dateRange);
  if (interval) {
    result = result.filter((s) =>
      isWithinInterval(new Date(s.startedAt), interval),
    );
  }

  return result;
}

function checkHasActiveFilters(searchQuery: string, statusFilter: SessionStatus | 'all', dateRange: DateRange): boolean {
  return searchQuery.trim() !== '' || statusFilter !== 'all' || dateRange !== 'all';
}

function toggleCompareId(prev: string[], sessionId: string): string[] {
  if (prev.includes(sessionId)) {
    return prev.filter((id) => id !== sessionId);
  }
  if (prev.length >= 2) {
    return [prev[0]!, sessionId];
  }
  return [...prev, sessionId];
}

function getDateRangeInterval(range: DateRange): { start: Date; end: Date } | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: subWeeks(now, 1), end: now };
    case 'month':
      return { start: subMonths(now, 1), end: now };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Session Card Component
// ---------------------------------------------------------------------------

function SessionCardCompareOverlay({ isSelected }: { isSelected: boolean }) {
  return (
    <div className="absolute top-3 right-3 z-10">
      <div
        className={cn(
          'h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
          isSelected
            ? 'bg-blue-500 border-blue-500 text-white'
            : 'border-muted-foreground/40 hover:border-blue-500',
        )}
      >
        {isSelected && <CheckCircle2 className="h-3 w-3" />}
      </div>
    </div>
  );
}

function SessionCardActions({
  session,
  isCurrent,
  onResume,
  onDuplicate,
  onDelete,
  isDeleting,
}: {
  session: SessionWithStats;
  isCurrent: boolean;
  onResume: () => void;
  onDuplicate: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}) {
  const showDelete = !isCurrent && session.status !== 'active';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {session.status === 'paused' && (
          <DropdownMenuItem onClick={onResume}>
            <Play className="h-4 w-4" />
            Resume
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        {showDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={isDeleting}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getSessionCardClassName(isCurrent: boolean, isSelected: boolean, isActionable: boolean, compareMode: boolean) {
  return cn(
    'group relative border rounded-lg transition-all duration-200',
    isCurrent && 'border-primary bg-primary/5 ring-1 ring-primary/20',
    isSelected && !isCurrent && 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20',
    !isCurrent && !isSelected && 'hover:bg-accent/50 hover:border-border/80',
    (isActionable || compareMode) && 'cursor-pointer',
  );
}

function SessionCard({
  session,
  isCurrent,
  isSelected,
  compareMode,
  onSelect,
  onToggleCompare,
  onResume,
  onDuplicate,
  onDelete,
  isDeleting,
}: {
  session: SessionWithStats;
  isCurrent: boolean;
  isSelected: boolean;
  compareMode: boolean;
  onSelect: () => void;
  onToggleCompare: () => void;
  onResume: () => void;
  onDuplicate: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleting: boolean;
}) {
  const statusInfo = STATUS_CONFIG[session.status];
  const isActionable = session.status === 'active' || session.status === 'paused';
  const startDate = new Date(session.startedAt);
  const endDate = session.endedAt ? new Date(session.endedAt) : null;
  const handleClick = compareMode ? onToggleCompare : isActionable ? onSelect : undefined;

  return (
    <div
      className={getSessionCardClassName(isCurrent, isSelected, isActionable, compareMode)}
      onClick={handleClick}
    >
      {compareMode && <SessionCardCompareOverlay isSelected={isSelected} />}

      <div className="p-4">
        {/* Top row: status + timestamp + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusInfo.variant} className="flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.label}
            </Badge>
            {isCurrent && (
              <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30">
                Current
              </Badge>
            )}
            {session.startBranch && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-mono">
                <GitBranch className="h-3 w-3" />
                {session.startBranch}
              </span>
            )}
          </div>

          {!compareMode && (
            <SessionCardActions
              session={session}
              isCurrent={isCurrent}
              onResume={onResume}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              isDeleting={isDeleting}
            />
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{session.taskCount}</span>
            <span>task{session.taskCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDuration(startDate, endDate)}</span>
          </div>
        </div>

        {/* Time info */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{format(startDate, 'MMM d, yyyy · h:mm a')}</span>
          <span>{formatDistanceToNow(startDate, { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Detail for Comparison
// ---------------------------------------------------------------------------

function ComparisonColumn({
  session,
  label,
}: {
  session: SessionWithStats;
  label: string;
}) {
  const { data: summaryData, isLoading } = useGetSessionSummaryQuery(session.id);
  const stats = summaryData?.stats;
  const statusInfo = STATUS_CONFIG[session.status];
  const startDate = new Date(session.startedAt);
  const endDate = session.endedAt ? new Date(session.endedAt) : null;

  return (
    <div className="flex-1 min-w-0 border rounded-lg overflow-hidden">
      {/* Column header */}
      <div className="px-4 py-2 bg-muted/50 border-b">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Status + ID */}
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant} className="flex items-center gap-1">
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{session.id.slice(0, 8)}</span>
        </div>

        {/* Branch */}
        {session.startBranch && (
          <div className="flex items-center gap-1.5 text-sm">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">{session.startBranch}</span>
          </div>
        )}

        {/* Time */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Started</span>
            <span>{format(startDate, 'MMM d, h:mm a')}</span>
          </div>
          {endDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ended</span>
              <span>{format(endDate, 'MMM d, h:mm a')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium">{formatDuration(startDate, endDate)}</span>
          </div>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-2">
            <StatCell label="Tasks" value={stats.totalTasks} icon={<FileText className="h-3.5 w-3.5" />} />
            <StatCell label="Completed" value={stats.completedTasks} icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />} />
            <StatCell label="Files Changed" value={stats.filesChanged} />
            <StatCell label="Commits" value={stats.commits} />
            {stats.rejectedTasks > 0 && (
              <StatCell label="Rejected" value={stats.rejectedTasks} icon={<XCircle className="h-3.5 w-3.5 text-yellow-600" />} />
            )}
            {stats.failedTasks > 0 && (
              <StatCell label="Failed" value={stats.failedTasks} icon={<AlertTriangle className="h-3.5 w-3.5 text-red-600" />} />
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-2">No stats available</div>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-md p-2.5 text-center">
      {icon && <div className="flex justify-center mb-1">{icon}</div>}
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-muted/60 flex items-center justify-center">
          <History className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          {hasFilters ? (
            <Filter className="h-4 w-4 text-muted-foreground/60" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground/60" />
          )}
        </div>
      </div>
      <h3 className="text-base font-medium mb-1">
        {hasFilters ? 'No matching sessions' : 'No sessions yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        {hasFilters
          ? 'Try adjusting your filters to find what you\'re looking for.'
          : 'Sessions will appear here as you work with this repository.'}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

function FilterBar({
  searchQuery,
  statusFilter,
  dateRange,
  onSearchChange,
  onStatusChange,
  onDateRangeChange,
}: {
  searchQuery: string;
  statusFilter: SessionStatus | 'all';
  dateRange: DateRange;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SessionStatus | 'all') => void;
  onDateRangeChange: (value: DateRange) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID or branch..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? 'Status'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              className={cn(statusFilter === option.value && 'bg-accent')}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? 'Date'}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {DATE_RANGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onDateRangeChange(option.value)}
              className={cn(dateRange === option.value && 'bg-accent')}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Filter Chips
// ---------------------------------------------------------------------------

function ActiveFilterChips({
  searchQuery,
  statusFilter,
  dateRange,
  onClearSearch,
  onClearStatus,
  onClearDateRange,
  onClearAll,
}: {
  searchQuery: string;
  statusFilter: SessionStatus | 'all';
  dateRange: DateRange;
  onClearSearch: () => void;
  onClearStatus: () => void;
  onClearDateRange: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {statusFilter !== 'all' && (
        <Badge
          variant="secondary"
          className="gap-1 cursor-pointer hover:bg-secondary/60"
          onClick={onClearStatus}
        >
          Status: {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}
          <X className="h-3 w-3" />
        </Badge>
      )}
      {dateRange !== 'all' && (
        <Badge
          variant="secondary"
          className="gap-1 cursor-pointer hover:bg-secondary/60"
          onClick={onClearDateRange}
        >
          {DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label}
          <X className="h-3 w-3" />
        </Badge>
      )}
      {searchQuery && (
        <Badge
          variant="secondary"
          className="gap-1 cursor-pointer hover:bg-secondary/60"
          onClick={onClearSearch}
        >
          Search: {searchQuery.length > 12 ? searchQuery.slice(0, 12) + '...' : searchQuery}
          <X className="h-3 w-3" />
        </Badge>
      )}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Overlay
// ---------------------------------------------------------------------------

function DeleteConfirmation({
  onCancel,
  onConfirm,
  isDeleting,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
      <div className="bg-background border rounded-lg p-6 shadow-lg max-w-sm mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">Delete Session</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              This will permanently delete the session and all its tasks. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination Footer
// ---------------------------------------------------------------------------

function PaginationFooter({
  page,
  totalPages,
  totalFiltered,
  scrollContainerRef,
  onPageChange,
  onClose,
}: {
  page: number;
  totalPages: number;
  totalFiltered: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onPageChange: (page: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="px-6 py-3 border-t flex items-center justify-between">
      <div className="text-xs text-muted-foreground">
        {totalFiltered > 0 && (
          <>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalFiltered)} of{' '}
            {totalFiltered}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => {
                onPageChange(page - 1);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="h-8 px-3"
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => {
                onPageChange(page + 1);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="h-8 px-3"
            >
              Next
            </Button>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={onClose} className="h-8">
          Close
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session List Content
// ---------------------------------------------------------------------------

function SessionListContent({
  isLoading,
  viewMode,
  compareIds,
  compareSessionA,
  compareSessionB,
  filteredSessions,
  paginatedSessions,
  currentSessionId,
  hasActiveFilters,
  isDeleting,
  scrollContainerRef,
  onSelectSession,
  onToggleCompare,
  onResume,
  onDuplicate,
  onDelete,
  onClearFilters,
}: {
  isLoading: boolean;
  viewMode: ViewMode;
  compareIds: string[];
  compareSessionA: SessionWithStats | undefined;
  compareSessionB: SessionWithStats | undefined;
  filteredSessions: SessionWithStats[];
  paginatedSessions: SessionWithStats[];
  currentSessionId?: string;
  hasActiveFilters: boolean;
  isDeleting: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectSession: (sessionId: string, status: SessionStatus) => void;
  onToggleCompare: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onDuplicate: (sessionId: string) => void;
  onDelete: (sessionId: string, e: React.MouseEvent) => void;
  onClearFilters: () => void;
}) {
  if (isLoading) {
    return (
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const showComparison = viewMode === 'compare' && compareIds.length === 2 && compareSessionA && compareSessionB;

  if (showComparison) {
    return (
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <ComparisonColumn session={compareSessionA} label="Session A" />
          <ComparisonColumn session={compareSessionB} label="Session B" />
        </div>
      </div>
    );
  }

  if (filteredSessions.length === 0) {
    return (
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
        <EmptyState hasFilters={hasActiveFilters} onClearFilters={onClearFilters} />
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-2">
        {paginatedSessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isCurrent={session.id === currentSessionId}
            isSelected={compareIds.includes(session.id)}
            compareMode={viewMode === 'compare'}
            onSelect={() => onSelectSession(session.id, session.status)}
            onToggleCompare={() => onToggleCompare(session.id)}
            onResume={() => onResume(session.id)}
            onDuplicate={() => onDuplicate(session.id)}
            onDelete={(e) => onDelete(session.id, e)}
            isDeleting={isDeleting}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare Instructions
// ---------------------------------------------------------------------------

function CompareInstructions({ viewMode, compareCount }: { viewMode: ViewMode; compareCount: number }) {
  if (viewMode !== 'compare' || compareCount >= 2) return null;

  const remaining = 2 - compareCount;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-md px-3 py-2">
      <ArrowLeftRight className="h-4 w-4 text-blue-500 shrink-0" />
      Select {remaining} more session{remaining > 1 ? 's' : ''} to compare
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export function SessionHistoryModal({
  repositoryId,
  repositoryName,
  currentSessionId,
  isOpen,
  onClose,
  onSelectSession,
}: SessionHistoryModalProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useListSessionsQuery(
    {
      repositoryId,
      limit: 100,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    },
    { skip: !isOpen },
  );

  const [deleteSession, { isLoading: isDeleting }] = useDeleteSessionMutation();
  const [resumeSession] = useResumeSessionMutation();

  const allSessions = data?.sessions ?? [];

  useEffect(() => {
    if (!isOpen) {
      setViewMode('list');
      setCompareIds([]);
      setPage(0);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  const filteredSessions = useMemo(
    () => filterSessions(allSessions, searchQuery, dateRange),
    [allSessions, searchQuery, dateRange],
  );

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const paginatedSessions = filteredSessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const hasActiveFilters = checkHasActiveFilters(searchQuery, statusFilter, dateRange);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateRange('all');
    setPage(0);
  }, []);

  const handleSelectSession = useCallback(
    async (sessionId: string, status: SessionStatus) => {
      if (status === 'paused') {
        await resumeSession(sessionId);
      }
      onSelectSession(sessionId);
      onClose();
    },
    [resumeSession, onSelectSession, onClose],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmDeleteId(sessionId);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    await deleteSession(confirmDeleteId);
    setConfirmDeleteId(null);
    refetch();
  }, [confirmDeleteId, deleteSession, refetch]);

  const handleResume = useCallback(
    async (sessionId: string) => {
      await resumeSession(sessionId);
      onSelectSession(sessionId);
      onClose();
    },
    [resumeSession, onSelectSession, onClose],
  );

  const handleDuplicate = useCallback(
    (sessionId: string) => {
      onSelectSession(sessionId);
      onClose();
    },
    [onSelectSession, onClose],
  );

  const handleToggleCompare = useCallback((sessionId: string) => {
    setCompareIds((prev) => toggleCompareId(prev, sessionId));
  }, []);

  const handleFilterSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(0);
  }, []);

  const handleStatusChange = useCallback((value: SessionStatus | 'all') => {
    setStatusFilter(value);
    setPage(0);
  }, []);

  const handleDateRangeChange = useCallback((value: DateRange) => {
    setDateRange(value);
    setPage(0);
  }, []);

  const handleToggleViewMode = useCallback(() => {
    if (viewMode === 'compare') {
      setViewMode('list');
      setCompareIds([]);
    } else {
      setViewMode('compare');
    }
  }, [viewMode]);

  const compareSessionA = allSessions.find((s) => s.id === compareIds[0]);
  const compareSessionB = allSessions.find((s) => s.id === compareIds[1]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Session History</DialogTitle>
                <DialogDescription className="mt-1">
                  {repositoryName} · {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
                </DialogDescription>
              </div>
              <Button
                variant={viewMode === 'compare' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 hidden sm:flex"
                onClick={handleToggleViewMode}
              >
                <ArrowLeftRight className="h-4 w-4" />
                Compare
              </Button>
            </div>
          </DialogHeader>

          <FilterBar
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            dateRange={dateRange}
            onSearchChange={handleFilterSearchChange}
            onStatusChange={handleStatusChange}
            onDateRangeChange={handleDateRangeChange}
          />

          {hasActiveFilters && (
            <ActiveFilterChips
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              dateRange={dateRange}
              onClearSearch={() => setSearchQuery('')}
              onClearStatus={() => setStatusFilter('all')}
              onClearDateRange={() => setDateRange('all')}
              onClearAll={clearFilters}
            />
          )}

          <CompareInstructions viewMode={viewMode} compareCount={compareIds.length} />
        </div>

        <SessionListContent
          isLoading={isLoading}
          viewMode={viewMode}
          compareIds={compareIds}
          compareSessionA={compareSessionA}
          compareSessionB={compareSessionB}
          filteredSessions={filteredSessions}
          paginatedSessions={paginatedSessions}
          currentSessionId={currentSessionId}
          hasActiveFilters={hasActiveFilters}
          isDeleting={isDeleting}
          scrollContainerRef={scrollContainerRef}
          onSelectSession={handleSelectSession}
          onToggleCompare={handleToggleCompare}
          onResume={handleResume}
          onDuplicate={handleDuplicate}
          onDelete={handleDeleteSession}
          onClearFilters={clearFilters}
        />

        <PaginationFooter
          page={page}
          totalPages={totalPages}
          totalFiltered={filteredSessions.length}
          scrollContainerRef={scrollContainerRef}
          onPageChange={setPage}
          onClose={onClose}
        />

        {confirmDeleteId && (
          <DeleteConfirmation
            onCancel={() => setConfirmDeleteId(null)}
            onConfirm={confirmDelete}
            isDeleting={isDeleting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
