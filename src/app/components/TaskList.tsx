'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react';
import { FixedSizeList as List } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime, truncate } from '@/shared/lib/utils';
import type { TaskUpdate } from '@/shared/hooks/useTaskStream';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  MoreVertical,
  Eye,
  Trash2,
  RefreshCw,
  CheckSquare2,
  Square,
  ArrowUpDown,
  Play,
  Pause,
  Ban,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import type { TaskStatus } from '@/db/schema/tasks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  prompt: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string | null;
  startedAt?: string | null;
}

interface TaskListProps {
  sessionId: string;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  updates?: TaskUpdate[];
  refreshTrigger?: number;
}

type SortField = 'createdAt' | 'status' | 'prompt';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_PRIORITY: Record<string, number> = {
  running: 0,
  qa_running: 1,
  waiting_approval: 2,
  waiting_qa: 3,
  pre_flight: 4,
  pending: 5,
  qa_failed: 6,
  approved: 7,
  completed: 8,
  failed: 9,
  rejected: 10,
  cancelled: 11,
};

const STATUS_GROUPS: {
  active: string[];
  completed: string[];
  failed: string[];
} = {
  active: [
    'running',
    'qa_running',
    'waiting_approval',
    'waiting_qa',
    'pre_flight',
    'pending',
  ],
  completed: ['approved', 'completed'],
  failed: ['qa_failed', 'failed', 'rejected', 'cancelled'],
};

const ITEM_HEIGHT = 72;

// Visual config per status
const STATUS_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    accent: string;
    bg: string;
    badgeClass: string;
    label: string;
  }
> = {
  running: {
    icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    accent: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    label: 'Running',
  },
  qa_running: {
    icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    accent: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    label: 'QA Running',
  },
  pre_flight: {
    icon: <Sparkles className="h-4 w-4 text-indigo-500" />,
    accent: 'border-l-indigo-400',
    bg: 'bg-indigo-500/5',
    badgeClass:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    label: 'Pre-flight',
  },
  waiting_approval: {
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    accent: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Needs Approval',
  },
  waiting_qa: {
    icon: <Pause className="h-4 w-4 text-orange-500" />,
    accent: 'border-l-orange-400',
    bg: 'bg-orange-500/5',
    badgeClass:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    label: 'Waiting QA',
  },
  pending: {
    icon: <Clock className="h-4 w-4 text-slate-400" />,
    accent: 'border-l-slate-300 dark:border-l-slate-600',
    bg: '',
    badgeClass:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    label: 'Pending',
  },
  qa_failed: {
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    accent: 'border-l-red-500',
    bg: 'bg-red-500/5',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'QA Failed',
  },
  approved: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    accent: 'border-l-emerald-500',
    bg: '',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Approved',
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    accent: 'border-l-emerald-500',
    bg: '',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Completed',
  },
  failed: {
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    accent: 'border-l-red-500',
    bg: '',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Failed',
  },
  rejected: {
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    accent: 'border-l-red-500',
    bg: '',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Rejected',
  },
  cancelled: {
    icon: <Ban className="h-4 w-4 text-slate-400" />,
    accent: 'border-l-slate-300 dark:border-l-slate-600',
    bg: '',
    badgeClass:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    label: 'Cancelled',
  },
};

const DEFAULT_STATUS_CONFIG = {
  icon: <Clock className="h-4 w-4 text-slate-400" />,
  accent: 'border-l-slate-300',
  bg: '',
  badgeClass: 'bg-slate-100 text-slate-600',
  label: 'Unknown',
};

function getConfig(status: string) {
  return STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG;
}

// Filter tabs
const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
  { value: 'failed', label: 'Failed' },
];

// ---------------------------------------------------------------------------
// Task Item
// ---------------------------------------------------------------------------

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
  isChecked: boolean;
  isFocused: boolean;
  batchMode: boolean;
  onSelect: (taskId: string) => void;
  onToggleCheck: (taskId: string) => void;
  onAction: (taskId: string, action: string) => void;
  style: React.CSSProperties;
}

const TaskItem = React.memo(function TaskItem({
  task,
  isSelected,
  isChecked,
  isFocused,
  batchMode,
  onSelect,
  onToggleCheck,
  onAction,
  style,
}: TaskItemProps) {
  const cfg = getConfig(task.status);
  const isRunning = ['running', 'qa_running', 'pre_flight'].includes(
    task.status
  );

  return (
    <div style={style} className="px-1">
      <div
        role="option"
        aria-selected={isSelected}
        className={cn(
          'group flex cursor-pointer items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5',
          'transition-colors duration-100',
          cfg.accent,
          // Background states
          isSelected
            ? 'bg-primary/8 dark:bg-primary/12'
            : isFocused
              ? 'bg-muted/60'
              : cfg.bg || 'hover:bg-muted/40',
          // Ring for keyboard focus
          isFocused && 'ring-1 ring-ring/40',
          // Subtle pulse for running tasks
          isRunning && !isSelected && 'animate-pulse-subtle'
        )}
        onClick={() => onSelect(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelect(task.id);
        }}
      >
        {/* Checkbox - shown in batch mode or on hover */}
        <div
          className={cn(
            'flex-shrink-0 transition-opacity',
            batchMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck(task.id);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={isChecked ? 'Deselect task' : 'Select task'}
            tabIndex={-1}
          >
            {isChecked ? (
              <CheckSquare2 className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Status icon */}
        <div className="flex-shrink-0">{cfg.icon}</div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {truncate(task.prompt, 72)}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                cfg.badgeClass
              )}
            >
              {cfg.label}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatRelativeTime(new Date(task.createdAt))}
            </span>
          </div>
        </div>

        {/* Right side: arrow / actions */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* Quick actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'rounded-md p-1 transition-opacity',
                  'opacity-0 focus:opacity-100 group-hover:opacity-100',
                  'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-label="Task actions"
                tabIndex={-1}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAction(task.id, 'view')}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              {task.status === 'failed' && (
                <DropdownMenuItem onClick={() => onAction(task.id, 'retry')}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </DropdownMenuItem>
              )}
              {['pending', 'waiting_approval', 'waiting_qa'].includes(
                task.status
              ) && (
                <DropdownMenuItem onClick={() => onAction(task.id, 'cancel')}>
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onAction(task.id, 'delete')}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Chevron indicator */}
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground/50 transition-transform',
              isSelected && 'translate-x-0.5 text-primary'
            )}
          />
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface TaskListHeaderProps {
  taskCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  onRefresh: () => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  tabCounts: Record<StatusFilter, number>;
}

function TaskListHeader({
  taskCount,
  searchQuery,
  onSearchChange,
  searchRef,
  sortField,
  sortDirection,
  onToggleSort,
  onRefresh,
  statusFilter,
  onStatusFilterChange,
  tabCounts,
}: TaskListHeaderProps) {
  return (
    <div className="flex-shrink-0 space-y-3 px-4 pb-2 pt-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
          <Badge
            variant="secondary"
            className="h-5 px-1.5 text-[10px] font-medium"
          >
            {taskCount}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ArrowUpDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleSort('createdAt')}>
                Date{' '}
                {sortField === 'createdAt' &&
                  (sortDirection === 'desc' ? '\u2193' : '\u2191')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleSort('status')}>
                Status{' '}
                {sortField === 'status' &&
                  (sortDirection === 'desc' ? '\u2193' : '\u2191')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleSort('prompt')}>
                Prompt{' '}
                {sortField === 'prompt' &&
                  (sortDirection === 'desc' ? '\u2193' : '\u2191')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onRefresh}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="text"
          placeholder='Search tasks... (press "/")'
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 border-0 bg-muted/40 pl-8 text-sm focus-visible:ring-1"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {FILTER_TABS.map((tab) => {
          const count = tabCounts[tab.value];
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onStatusFilterChange(tab.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-1 text-[10px]',
                    isActive ? 'opacity-80' : 'opacity-60'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TaskBatchActionsBarProps {
  checkedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onBulkAction: (action: string) => void;
}

function TaskBatchActionsBar({ checkedCount, totalCount, onSelectAll, onBulkAction }: TaskBatchActionsBarProps) {
  return (
    <div className="mx-4 mb-2 flex flex-shrink-0 items-center gap-2 rounded-lg border bg-muted/80 px-3 py-2">
      <button onClick={onSelectAll} className="text-xs font-medium text-muted-foreground hover:text-foreground">
        {checkedCount === totalCount ? 'Deselect all' : 'Select all'}
      </button>
      <span className="text-[10px] text-muted-foreground">{checkedCount} selected</span>
      <div className="ml-auto flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => onBulkAction('cancel')} className="h-6 px-2 text-xs text-destructive hover:text-destructive">
          Cancel
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onBulkAction('delete')} className="h-6 px-2 text-xs text-destructive hover:text-destructive">
          <Trash2 className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function TaskKeyboardHint() {
  return (
    <div className="flex-shrink-0 border-t px-4 py-2">
      <p className="text-center text-[10px] text-muted-foreground/60">
        <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">/</kbd>{' '}search{' \u00B7 '}
        <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">\u2191\u2193</kbd>{' '}navigate{' \u00B7 '}
        <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">\u23CE</kbd>{' '}select{' \u00B7 '}
        <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px]">Space</kbd>{' '}check
      </p>
    </div>
  );
}

interface TaskListBodyProps {
  processedTasks: Task[];
  searchQuery: string;
  statusFilter: StatusFilter;
  listHeight: number;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
  listRef: React.RefObject<List | null>;
  Row: React.ComponentType<ListChildComponentProps>;
  onClearFilters: () => void;
}

function TaskListBody({ processedTasks, searchQuery, statusFilter, listHeight, listContainerRef, listRef, Row, onClearFilters }: TaskListBodyProps) {
  return (
    <div className="flex-1 overflow-hidden" ref={listContainerRef}>
      {processedTasks.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          {searchQuery || statusFilter !== 'all' ? (
            <>
              <Search className="mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No matching tasks</p>
              <button onClick={onClearFilters} className="mt-1.5 text-xs text-primary hover:underline">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Play className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No tasks yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Submit a prompt to get started</p>
            </>
          )}
        </div>
      ) : (
        <List ref={listRef} height={listHeight} itemCount={processedTasks.length} itemSize={ITEM_HEIGHT} width="100%" overscanCount={5} className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {Row}
        </List>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TaskList({
  sessionId,
  selectedTaskId,
  onSelectTask,
  updates = [],
  refreshTrigger = 0,
}: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [listHeight, setListHeight] = useState(400);

  const batchMode = checkedTasks.size > 0;

  // ---- Data loading ----

  const loadSessionTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error('Failed to load session');
      const data = await res.json();
      setTasks(data.session.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSessionTasks();
  }, [sessionId, refreshTrigger, loadSessionTasks]);

  useLayoutEffect(() => {
    function updateHeight() {
      if (listContainerRef.current) {
        const height = listContainerRef.current.clientHeight;
        if (height > 0) setListHeight(height);
      }
    }
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (listContainerRef.current) observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // SSE updates
  useEffect(() => {
    const latestUpdate = updates[updates.length - 1];
    if (
      latestUpdate?.type === 'task_update' &&
      latestUpdate.taskId &&
      typeof latestUpdate.status === 'string'
    ) {
      setTasks((prev) => {
        const taskExists = prev.some((t) => t.id === latestUpdate.taskId);

        // If task doesn't exist in our list (e.g., new plan task), refetch
        if (!taskExists) {
          console.log(
            '[TaskList] Received update for unknown task, refetching:',
            latestUpdate.taskId
          );
          loadSessionTasks();
          return prev;
        }

        // Update existing task status
        return prev.map((task) =>
          task.id === latestUpdate.taskId
            ? { ...task, status: latestUpdate.status as TaskStatus }
            : task
        );
      });
    }
  }, [updates, loadSessionTasks]);

  // ---- Filtering & sorting ----

  const processedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.prompt.toLowerCase().includes(q) ||
          task.status.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((t) =>
        STATUS_GROUPS.active.includes(t.status)
      );
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter((t) =>
        STATUS_GROUPS.completed.includes(t.status)
      );
    } else if (statusFilter === 'failed') {
      filtered = filtered.filter((t) =>
        STATUS_GROUPS.failed.includes(t.status)
      );
    }

    // Sort based on user's selection
    filtered.sort((a, b) => {
      // Only pin actively running tasks to top when NOT filtering by status
      if (sortField !== 'status' && statusFilter === 'all') {
        const aIsActive = ['running', 'qa_running', 'pre_flight'].includes(
          a.status
        );
        const bIsActive = ['running', 'qa_running', 'pre_flight'].includes(
          b.status
        );
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
      }

      // Apply user's chosen sort
      if (sortField === 'createdAt') {
        const dA = new Date(a.createdAt).getTime();
        const dB = new Date(b.createdAt).getTime();
        return sortDirection === 'desc' ? dB - dA : dA - dB;
      }
      if (sortField === 'status') {
        const pA = STATUS_PRIORITY[a.status] ?? 100;
        const pB = STATUS_PRIORITY[b.status] ?? 100;
        if (pA !== pB) {
          return sortDirection === 'desc' ? pB - pA : pA - pB;
        }
        return 0;
      }
      if (sortField === 'prompt') {
        return sortDirection === 'desc'
          ? b.prompt.localeCompare(a.prompt)
          : a.prompt.localeCompare(b.prompt);
      }
      return 0;
    });

    return filtered;
  }, [tasks, searchQuery, statusFilter, sortField, sortDirection]);

  // ---- Keyboard navigation ----

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!containerRef.current?.contains(document.activeElement)) return;
      // Don't hijack input fields
      if (document.activeElement instanceof HTMLInputElement) {
        if (e.key === 'Escape') {
          (document.activeElement as HTMLInputElement).blur();
          setFocusedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.min(prev + 1, processedTasks.length - 1);
            listRef.current?.scrollToItem(next, 'smart');
            return next;
          });
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            listRef.current?.scrollToItem(next, 'smart');
            return next;
          });
          break;
        case 'Enter': {
          e.preventDefault();
          const enterTask = processedTasks[focusedIndex];
          if (focusedIndex >= 0 && enterTask) {
            onSelectTask(enterTask.id);
          }
          break;
        }
        case ' ': {
          e.preventDefault();
          const spaceTask = processedTasks[focusedIndex];
          if (focusedIndex >= 0 && spaceTask) {
            toggleCheck(spaceTask.id);
          }
          break;
        }
        case '/':
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case 'Escape':
          if (batchMode) {
            setCheckedTasks(new Set());
          } else {
            setFocusedIndex(-1);
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, processedTasks, onSelectTask, batchMode]);

  // ---- Selection handlers ----

  const toggleCheck = useCallback((taskId: string) => {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (checkedTasks.size === processedTasks.length) {
      setCheckedTasks(new Set());
    } else {
      setCheckedTasks(new Set(processedTasks.map((t) => t.id)));
    }
  }, [checkedTasks.size, processedTasks]);

  const handleBulkAction = useCallback(
    (action: string) => {
      const taskIds = Array.from(checkedTasks);
      console.log('Bulk action:', action, 'on tasks:', taskIds);
      // TODO: Implement actual bulk actions
      setCheckedTasks(new Set());
    },
    [checkedTasks]
  );

  const handleTaskAction = useCallback(
    (taskId: string, action: string) => {
      if (action === 'view') {
        onSelectTask(taskId);
      }
      // TODO: Implement other actions (retry, cancel, delete)
    },
    [onSelectTask]
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField]
  );

  // ---- Virtualized row renderer ----

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const task = processedTasks[index];
      if (!task) return null;
      return (
        <TaskItem
          task={task}
          isSelected={selectedTaskId === task.id}
          isChecked={checkedTasks.has(task.id)}
          isFocused={focusedIndex === index}
          batchMode={batchMode}
          onSelect={onSelectTask}
          onToggleCheck={toggleCheck}
          onAction={handleTaskAction}
          style={style}
        />
      );
    },
    [
      processedTasks,
      selectedTaskId,
      checkedTasks,
      focusedIndex,
      batchMode,
      onSelectTask,
      toggleCheck,
      handleTaskAction,
    ]
  );

  // ---- Counts for filter tabs ----
  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: tasks.length,
      active: 0,
      completed: 0,
      failed: 0,
    };
    for (const t of tasks) {
      if (STATUS_GROUPS.active.includes(t.status)) counts.active++;
      else if (STATUS_GROUPS.completed.includes(t.status)) counts.completed++;
      else if (STATUS_GROUPS.failed.includes(t.status)) counts.failed++;
    }
    return counts;
  }, [tasks]);

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex h-full flex-col rounded-xl border bg-card">
        <div className="border-b p-4">
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex h-full flex-col rounded-xl border bg-card shadow-sm focus:outline-none"
    >
      <TaskListHeader
        taskCount={processedTasks.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchRef={searchRef}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggleSort={toggleSort}
        onRefresh={loadSessionTasks}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        tabCounts={tabCounts}
      />

      {/* ---- Batch actions bar ---- */}
      {batchMode && (
        <TaskBatchActionsBar
          checkedCount={checkedTasks.size}
          totalCount={processedTasks.length}
          onSelectAll={handleSelectAll}
          onBulkAction={handleBulkAction}
        />
      )}

      {/* ---- Task list ---- */}
      <TaskListBody
        processedTasks={processedTasks}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        listHeight={listHeight}
        listContainerRef={listContainerRef}
        listRef={listRef}
        Row={Row}
        onClearFilters={() => { setSearchQuery(''); setStatusFilter('all'); }}
      />

      {/* ---- Keyboard hint ---- */}
      <TaskKeyboardHint />
    </div>
  );
}
