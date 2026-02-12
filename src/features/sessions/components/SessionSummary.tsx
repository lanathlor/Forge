'use client';

import * as React from 'react';
import { format, formatDistanceStrict } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  useGetEnhancedSessionSummaryQuery,
  type EnhancedSessionSummary,
  type EnhancedTaskSummary,
} from '../store/sessionsApi';
import {
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  GitCommit,
  AlertTriangle,
  GitBranch,
  Loader2,
  Download,
  FileCode2,
  Plus,
  Minus,
  Shield,
  ChevronDown,
  ChevronRight,
  Activity,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SessionSummaryProps {
  sessionId: string;
  className?: string;
  onTaskClick?: (taskId: string) => void;
}

type ExportFormat = 'json' | 'markdown';

// ============================================================================
// Utility functions
// ============================================================================

function formatDurationMs(ms: number): string {
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

function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-success';
    case 'failed':
    case 'qa_failed':
      return 'text-error';
    case 'rejected':
      return 'text-warning';
    case 'running':
    case 'qa_running':
    case 'pre_flight':
      return 'text-info';
    case 'pending':
    case 'waiting_qa':
    case 'waiting_approval':
      return 'text-text-muted';
    case 'approved':
      return 'text-success';
    case 'cancelled':
      return 'text-text-muted';
    default:
      return 'text-text-secondary';
  }
}

function getTaskStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// SVG Chart Components (no external dependencies)
// ============================================================================

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

function TaskStatusPieChart({ tasks }: { tasks: EnhancedTaskSummary[] }) {
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      const key = t.status;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const slices: PieSlice[] = React.useMemo(() => {
    const colorMap: Record<string, string> = {
      completed: 'var(--color-success, #22c55e)',
      failed: 'var(--color-error, #ef4444)',
      qa_failed: 'var(--color-error, #ef4444)',
      rejected: 'var(--color-warning, #f59e0b)',
      running: 'var(--color-info, #3b82f6)',
      pending: 'var(--color-text-muted, #94a3b8)',
      cancelled: 'var(--color-text-muted, #94a3b8)',
      approved: 'var(--color-success, #22c55e)',
      waiting_qa: '#8b5cf6',
      waiting_approval: '#06b6d4',
      qa_running: 'var(--color-info, #3b82f6)',
      pre_flight: '#a78bfa',
    };

    return Object.entries(statusCounts)
      .filter(([, v]) => v > 0)
      .map(([status, count]) => ({
        label: getTaskStatusLabel(status),
        value: count,
        color: colorMap[status] ?? '#94a3b8',
      }));
  }, [statusCounts]);

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-text-muted text-sm">
        No tasks
      </div>
    );
  }

  // Build SVG pie chart
  const radius = 60;
  const cx = 70;
  const cy = 70;
  let cumulativeAngle = -90; // Start from top

  const paths = slices.map((slice) => {
    const angle = (slice.value / total) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    // Single-slice case: draw a full circle
    if (slices.length === 1) {
      return (
        <circle
          key={slice.label}
          cx={cx}
          cy={cy}
          r={radius}
          fill={slice.color}
        />
      );
    }

    const d = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    return <path key={slice.label} d={d} fill={slice.color} />;
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-28 h-28 sm:w-32 sm:h-32 shrink-0">
        {paths}
        {/* Center circle for donut effect */}
        <circle cx={cx} cy={cy} r={35} className="fill-card" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-text-primary text-lg font-bold"
          fontSize="18"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-text-muted"
          fontSize="10"
        >
          tasks
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-text-secondary truncate">{slice.label}</span>
            <span className="text-text-primary font-medium ml-auto">{slice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline({
  timeline,
}: {
  timeline: EnhancedSessionSummary['timeline'];
}) {
  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-text-muted text-sm">
        No activity recorded
      </div>
    );
  }

  // Build a mini line chart: x = time, y = cumulative task completions
  const firstEvent = timeline[0]!;
  const lastEvent = timeline[timeline.length - 1]!;
  const startTime = new Date(firstEvent.timestamp).getTime();
  const endTime = new Date(lastEvent.timestamp).getTime();
  const timeRange = endTime - startTime || 1;

  const width = 320;
  const height = 80;
  const padX = 8;
  const padY = 8;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  let cumCompleted = 0;
  let cumFailed = 0;
  const maxCount = timeline.filter(
    (e) => e.type === 'task_complete' || e.type === 'task_fail'
  ).length || 1;

  const completedPoints: string[] = [`${padX},${height - padY}`];
  const failedPoints: string[] = [];

  for (const event of timeline) {
    const x = padX + ((new Date(event.timestamp).getTime() - startTime) / timeRange) * chartW;

    if (event.type === 'task_complete') {
      cumCompleted++;
      const y = height - padY - (cumCompleted / maxCount) * chartH;
      completedPoints.push(`${x},${y}`);
    } else if (event.type === 'task_fail') {
      cumFailed++;
      failedPoints.push(`${x},${height - padY - 4}`);
    }
  }

  // Close the area polygon
  if (completedPoints.length > 1) {
    const lastX = completedPoints[completedPoints.length - 1]!.split(',')[0];
    completedPoints.push(`${lastX},${height - padY}`);
  }

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={padX}
            y1={height - padY - frac * chartH}
            x2={width - padX}
            y2={height - padY - frac * chartH}
            className="stroke-border-muted"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}
        {/* Completed area */}
        {completedPoints.length > 2 && (
          <polygon
            points={completedPoints.join(' ')}
            className="fill-success/15"
          />
        )}
        {/* Completed line */}
        {completedPoints.length > 2 && (
          <polyline
            points={completedPoints.slice(1, -1).join(' ')}
            className="stroke-success"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Failed markers */}
        {failedPoints.map((pt, i) => {
          const [x] = pt.split(',').map(Number);
          return (
            <circle
              key={i}
              cx={x}
              cy={height - padY - 4}
              r={3}
              className="fill-error"
            />
          );
        })}
        {/* Baseline */}
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          className="stroke-border"
          strokeWidth={1}
        />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-text-muted px-2 -mt-1">
        <span>{format(new Date(firstEvent.timestamp), 'HH:mm')}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-success inline-block rounded" />
            completed
          </span>
          {cumFailed > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-error inline-block rounded-full" />
              failed
            </span>
          )}
        </div>
        <span>{format(new Date(lastEvent.timestamp), 'HH:mm')}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SummaryLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-text-muted" />
      <p className="text-sm text-text-muted">Loading session summary...</p>
    </div>
  );
}

function SummaryErrorState() {
  return (
    <div className="text-center py-12 text-text-muted">
      Session data not available
    </div>
  );
}

function SessionInfoBar({ summary }: { summary: EnhancedSessionSummary }) {
  const session = summary.session;
  const stats = summary.stats;

  return (
    <div className="bg-surface-raised rounded-lg border border-border p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-text-primary truncate">
            {session.repository.name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {format(new Date(session.startedAt), 'MMM d, yyyy h:mm a')}
            {session.endedAt && (
              <> — {format(new Date(session.endedAt), 'h:mm a')}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1 text-text-muted">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium text-text-primary">
              {formatDurationMs(stats.duration)}
            </span>
          </div>
          {(session.startBranch || session.endBranch) && (
            <div className="flex items-center gap-1 text-text-muted">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-mono text-text-primary">
                {session.startBranch}
                {session.endBranch && session.endBranch !== session.startBranch && (
                  <> → {session.endBranch}</>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  value,
  label,
  variant = 'default',
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
}) {
  const variantClasses = {
    default: 'bg-surface-raised',
    success: 'bg-success/5 border-success/20',
    error: 'bg-error/5 border-error/20',
    warning: 'bg-warning/5 border-warning/20',
    info: 'bg-info/5 border-info/20',
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border p-3 text-center',
        variantClasses[variant]
      )}
    >
      <div className="flex items-center justify-center mb-1.5 text-text-muted">
        {icon}
      </div>
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-[11px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

function StatsGrid({ summary }: { summary: EnhancedSessionSummary }) {
  const { stats, qaStats } = summary;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard
        icon={<FileText className="h-4 w-4" />}
        value={stats.totalTasks}
        label="Total Tasks"
      />
      <MetricCard
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        value={stats.completedTasks}
        label="Completed"
        variant="success"
      />
      <MetricCard
        icon={<XCircle className="h-4 w-4 text-error" />}
        value={stats.failedTasks + stats.rejectedTasks}
        label="Failed / Rejected"
        variant={stats.failedTasks + stats.rejectedTasks > 0 ? 'error' : 'default'}
      />
      <MetricCard
        icon={<GitCommit className="h-4 w-4" />}
        value={stats.commits}
        label="Commits"
      />
      <MetricCard
        icon={<FileCode2 className="h-4 w-4" />}
        value={stats.filesChanged}
        label="Files Changed"
      />
      <MetricCard
        icon={<Shield className="h-4 w-4 text-info" />}
        value={`${qaStats.passRate}%`}
        label="QA Pass Rate"
        variant={qaStats.passRate >= 80 ? 'success' : qaStats.passRate >= 50 ? 'warning' : 'error'}
      />
    </div>
  );
}

function CodeChangeSummary({
  totalAdditions,
  totalDeletions,
}: {
  totalAdditions: number;
  totalDeletions: number;
}) {
  if (totalAdditions === 0 && totalDeletions === 0) return null;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1 text-success">
        <Plus className="h-3 w-3" />
        {totalAdditions.toLocaleString()} additions
      </span>
      <span className="flex items-center gap-1 text-error">
        <Minus className="h-3 w-3" />
        {totalDeletions.toLocaleString()} deletions
      </span>
    </div>
  );
}

function TaskBreakdownList({
  tasks,
  onTaskClick,
}: {
  tasks: EnhancedTaskSummary[];
  onTaskClick?: (taskId: string) => void;
}) {
  const [expandedTask, setExpandedTask] = React.useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4 text-center">No tasks in this session</p>
    );
  }

  return (
    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
      {tasks.map((task) => {
        const isExpanded = expandedTask === task.id;
        const duration =
          task.startedAt && task.completedAt
            ? formatDistanceStrict(
                new Date(task.startedAt),
                new Date(task.completedAt)
              )
            : null;

        return (
          <div key={task.id} className="bg-card">
            <button
              onClick={() => {
                if (onTaskClick) {
                  onTaskClick(task.id);
                } else {
                  setExpandedTask(isExpanded ? null : task.id);
                }
              }}
              className="w-full text-left p-3 hover:bg-surface-interactive transition-colors flex items-start gap-2"
            >
              <span className="mt-0.5 shrink-0">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {task.prompt}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] px-1.5 py-0', getTaskStatusColor(task.status))}
                  >
                    {getTaskStatusLabel(task.status)}
                  </Badge>
                  {duration && (
                    <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {duration}
                    </span>
                  )}
                  {task.filesChanged.length > 0 && (
                    <span className="text-[10px] text-text-muted">
                      {task.filesChanged.length} file{task.filesChanged.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {task.qaResults.length > 0 && (
                    <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                      <Shield className="h-2.5 w-2.5" />
                      {task.qaResults.filter((r) => r.status === 'passed').length}/
                      {task.qaResults.length} QA
                    </span>
                  )}
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 ml-6 space-y-2">
                {task.commitMessage && (
                  <div className="text-xs bg-surface-raised rounded p-2">
                    <span className="text-text-muted">Commit: </span>
                    <span className="font-mono text-text-secondary">
                      {task.committedSha?.slice(0, 7)}
                    </span>{' '}
                    <span className="text-text-primary">{task.commitMessage}</span>
                  </div>
                )}
                {task.filesChanged.length > 0 && (
                  <div className="text-xs space-y-0.5">
                    {task.filesChanged.slice(0, 5).map((f) => (
                      <div key={f.path} className="flex items-center gap-2 text-text-secondary">
                        <FileCode2 className="h-3 w-3 shrink-0" />
                        <span className="font-mono truncate">{f.path}</span>
                        <span className="text-success ml-auto">+{f.additions}</span>
                        <span className="text-error">-{f.deletions}</span>
                      </div>
                    ))}
                    {task.filesChanged.length > 5 && (
                      <p className="text-text-muted pl-5">
                        +{task.filesChanged.length - 5} more files
                      </p>
                    )}
                  </div>
                )}
                {task.qaResults.length > 0 && (
                  <div className="text-xs space-y-0.5">
                    {task.qaResults.map((qr, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {qr.status === 'passed' ? (
                          <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                        ) : qr.status === 'failed' ? (
                          <XCircle className="h-3 w-3 text-error shrink-0" />
                        ) : (
                          <Clock className="h-3 w-3 text-text-muted shrink-0" />
                        )}
                        <span className="text-text-secondary">{qr.gateName}</span>
                        {qr.duration != null && (
                          <span className="text-text-muted ml-auto">
                            {formatDurationMs(qr.duration)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventTimeline({
  timeline,
}: {
  timeline: EnhancedSessionSummary['timeline'];
}) {
  const [showAll, setShowAll] = React.useState(false);
  const displayed = showAll ? timeline : timeline.slice(0, 8);

  const iconForType = (type: string) => {
    switch (type) {
      case 'session_start':
        return <Activity className="h-3 w-3 text-info" />;
      case 'task_start':
        return <ChevronRight className="h-3 w-3 text-text-muted" />;
      case 'task_complete':
        return <CheckCircle2 className="h-3 w-3 text-success" />;
      case 'task_fail':
        return <XCircle className="h-3 w-3 text-error" />;
      case 'session_end':
        return <Activity className="h-3 w-3 text-text-muted" />;
      default:
        return <Clock className="h-3 w-3 text-text-muted" />;
    }
  };

  return (
    <div className="space-y-0">
      {displayed.map((event, i) => (
        <div key={i} className="flex items-start gap-2 py-1.5 relative">
          {/* Vertical connector line */}
          {i < displayed.length - 1 && (
            <div className="absolute left-[7px] top-6 bottom-0 w-px bg-border" />
          )}
          <span className="shrink-0 mt-0.5 relative z-10 bg-card">
            {iconForType(event.type)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-primary truncate">{event.label}</p>
            <p className="text-[10px] text-text-muted">
              {format(new Date(event.timestamp), 'h:mm:ss a')}
            </p>
          </div>
        </div>
      ))}
      {timeline.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-accent-primary hover:text-accent-primary-hover mt-1 ml-5"
        >
          {showAll ? 'Show less' : `Show all ${timeline.length} events`}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Export functionality
// ============================================================================

function generateMarkdownReport(summary: EnhancedSessionSummary): string {
  const { session, stats, qaStats, tasks, timeline, totalAdditions, totalDeletions } = summary;
  const lines: string[] = [];

  lines.push(`# Session Summary: ${session.repository.name}`);
  lines.push('');
  lines.push(`**Started:** ${format(new Date(session.startedAt), 'MMM d, yyyy h:mm a')}`);
  if (session.endedAt) {
    lines.push(`**Ended:** ${format(new Date(session.endedAt), 'MMM d, yyyy h:mm a')}`);
  }
  lines.push(`**Duration:** ${formatDurationMs(stats.duration)}`);
  if (session.startBranch) {
    lines.push(`**Branch:** ${session.startBranch}${session.endBranch && session.endBranch !== session.startBranch ? ` → ${session.endBranch}` : ''}`);
  }
  lines.push('');

  lines.push('## Metrics');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Tasks | ${stats.totalTasks} |`);
  lines.push(`| Completed | ${stats.completedTasks} |`);
  lines.push(`| Failed | ${stats.failedTasks} |`);
  lines.push(`| Rejected | ${stats.rejectedTasks} |`);
  lines.push(`| Commits | ${stats.commits} |`);
  lines.push(`| Files Changed | ${stats.filesChanged} |`);
  lines.push(`| Lines Added | ${totalAdditions} |`);
  lines.push(`| Lines Removed | ${totalDeletions} |`);
  lines.push(`| QA Pass Rate | ${qaStats.passRate}% (${qaStats.passed}/${qaStats.totalRuns}) |`);
  lines.push('');

  if (tasks.length > 0) {
    lines.push('## Tasks');
    lines.push('');
    for (const task of tasks) {
      const status = getTaskStatusLabel(task.status);
      lines.push(`### ${task.prompt}`);
      lines.push(`- **Status:** ${status}`);
      if (task.startedAt && task.completedAt) {
        lines.push(`- **Duration:** ${formatDistanceStrict(new Date(task.startedAt), new Date(task.completedAt))}`);
      }
      if (task.commitMessage) {
        lines.push(`- **Commit:** \`${task.committedSha?.slice(0, 7)}\` ${task.commitMessage}`);
      }
      if (task.filesChanged.length > 0) {
        lines.push(`- **Files:** ${task.filesChanged.map((f) => `\`${f.path}\``).join(', ')}`);
      }
      if (task.qaResults.length > 0) {
        lines.push(`- **QA:** ${task.qaResults.map((r) => `${r.gateName} (${r.status})`).join(', ')}`);
      }
      lines.push('');
    }
  }

  if (timeline.length > 0) {
    lines.push('## Timeline');
    lines.push('');
    for (const event of timeline) {
      const time = format(new Date(event.timestamp), 'h:mm:ss a');
      lines.push(`- **${time}** — ${event.label}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}*`);

  return lines.join('\n');
}

function exportReport(summary: EnhancedSessionSummary, fmt: ExportFormat) {
  let content: string;
  let mimeType: string;
  let extension: string;

  if (fmt === 'json') {
    content = JSON.stringify(summary, null, 2);
    mimeType = 'application/json';
    extension = 'json';
  } else {
    content = generateMarkdownReport(summary);
    mimeType = 'text/markdown';
    extension = 'md';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-summary-${summary.session.repository.name}-${format(new Date(summary.session.startedAt), 'yyyy-MM-dd')}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExportMenu({ summary }: { summary: EnhancedSessionSummary }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
            <button
              onClick={() => {
                exportReport(summary, 'markdown');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-interactive transition-colors flex items-center gap-2"
            >
              <FileText className="h-3.5 w-3.5" />
              Markdown
            </button>
            <button
              onClick={() => {
                exportReport(summary, 'json');
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-interactive transition-colors flex items-center gap-2"
            >
              <FileCode2 className="h-3.5 w-3.5" />
              JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Section wrapper
// ============================================================================

function SummarySection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SessionSummary({
  sessionId,
  className,
  onTaskClick,
}: SessionSummaryProps) {
  const { data: summary, isLoading, isError } = useGetEnhancedSessionSummaryQuery(sessionId);

  if (isLoading) return <SummaryLoadingState />;
  if (isError || !summary) return <SummaryErrorState />;

  const pendingTasks = summary.tasks.filter(
    (t) =>
      t.status === 'pending' ||
      t.status === 'running' ||
      t.status === 'pre_flight' ||
      t.status === 'waiting_qa' ||
      t.status === 'qa_running' ||
      t.status === 'waiting_approval'
  );
  const hasPending = pendingTasks.length > 0;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Session Summary
        </h3>
        <ExportMenu summary={summary} />
      </div>

      {/* Session info bar */}
      <SessionInfoBar summary={summary} />

      {/* Aggregate metrics */}
      <StatsGrid summary={summary} />

      {/* Code changes */}
      <CodeChangeSummary
        totalAdditions={summary.totalAdditions}
        totalDeletions={summary.totalDeletions}
      />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-lg p-4">
          <SummarySection
            title="Task Status Distribution"
            icon={<Activity className="h-4 w-4" />}
          >
            <TaskStatusPieChart tasks={summary.tasks} />
          </SummarySection>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <SummarySection
            title="Activity Over Time"
            icon={<BarChart3 className="h-4 w-4" />}
          >
            <ActivityTimeline timeline={summary.timeline} />
          </SummarySection>
        </div>
      </div>

      {/* Pending alert */}
      {hasPending && (
        <div className="flex items-center gap-2 text-sm bg-warning/5 border border-warning/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            <span className="font-medium text-warning">{pendingTasks.length}</span>{' '}
            task{pendingTasks.length !== 1 ? 's' : ''} still in progress
          </span>
        </div>
      )}

      {/* Task breakdown */}
      <SummarySection
        title="Task Breakdown"
        icon={<FileText className="h-4 w-4" />}
      >
        <TaskBreakdownList tasks={summary.tasks} onTaskClick={onTaskClick} />
      </SummarySection>

      {/* Event timeline */}
      <div className="bg-card border border-border rounded-lg p-4">
        <SummarySection
          title="Timeline"
          icon={<Clock className="h-4 w-4" />}
        >
          <EventTimeline timeline={summary.timeline} />
        </SummarySection>
      </div>
    </div>
  );
}

export default SessionSummary;
