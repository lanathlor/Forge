'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';
import {
  usePlanRefinementChat,
  QUICK_ACTIONS,
  type ChatMessage,
  type Proposal,
} from '../hooks/usePlanRefinementChat';
import {
  Send,
  Loader2,
  Check,
  X,
  CheckCircle2,
  Sparkles,
  Plus,
  Minus,
  Pencil,
  ChevronRight,
  ChevronDown,
  ListPlus,
  Minimize2,
  Shield,
  Bug,
  Wand2,
  Play,
  Layers,
  Eye,
  MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Icon map for quick actions (hook stores string names)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  'list-plus': ListPlus,
  minimize: Minimize2,
  shield: Shield,
  bug: Bug,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanRefinementChatProps {
  planId: string;
  open: boolean;
  onClose: () => void;
  onLaunch?: () => void;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PlanRefinementChat({
  planId,
  open,
  onClose,
  onLaunch,
}: PlanRefinementChatProps) {
  const chat = usePlanRefinementChat(planId, open);
  const [activePanel, setActivePanel] = useState<'chat' | 'preview'>('chat');
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chat.sendMessage();
    }
  };

  const togglePhase = (order: number) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(order)) next.delete(order);
      else next.add(order);
      return next;
    });
  };

  // Build plan preview data
  const planPreview = useMemo(() => {
    if (!chat.planData) return null;
    const { phases, tasks } = chat.planData;
    return phases
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((phase) => ({
        ...phase,
        tasks: tasks
          .filter((t) => t.phaseId === phase.id)
          .sort((a, b) => a.order - b.order),
      }));
  }, [chat.planData]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'flex flex-col border-l border-border bg-card',
        'lg:relative lg:w-[460px] lg:flex-shrink-0',
        'fixed inset-0 z-50 lg:static lg:z-auto'
      )}
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Wand2 className="h-4 w-4 flex-shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">Refine Plan</span>
          {chat.totalApplied > 0 && (
            <Badge
              variant="default"
              className="flex h-5 items-center gap-1 px-1.5 py-0 text-[10px]"
            >
              <CheckCircle2 className="h-3 w-3" />
              {chat.totalApplied}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onLaunch && (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={onLaunch}
            >
              <Play className="mr-1 h-3 w-3" />
              Launch
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile panel toggle */}
      <div className="flex flex-shrink-0 border-b border-border lg:hidden">
        <button
          onClick={() => setActivePanel('chat')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activePanel === 'chat'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <MessageSquare className="h-3 w-3" />
          Chat
        </button>
        <button
          onClick={() => setActivePanel('preview')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activePanel === 'preview'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground'
          )}
        >
          <Eye className="h-3 w-3" />
          Plan Preview
        </button>
      </div>

      {/* Content area: split on desktop, tabbed on mobile */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Chat panel */}
        <div
          className={cn(
            'flex min-h-0 flex-col',
            'lg:flex-1 lg:border-r lg:border-border',
            activePanel === 'chat' ? 'flex-1' : 'hidden lg:flex'
          )}
        >
          {/* Messages */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {chat.messages.map((message, idx) => (
              <MessageBubble
                key={idx}
                message={message}
                messageIdx={idx}
                isLoading={
                  chat.isLoading &&
                  idx === chat.messages.length - 1 &&
                  message.role === 'assistant'
                }
                onProposalAction={chat.setProposalStatus}
                onAcceptAll={chat.acceptAllAndApply}
                onApplyAccepted={chat.applyAccepted}
              />
            ))}

            {chat.isLoading &&
              chat.messages[chat.messages.length - 1]?.role !== 'assistant' && (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </div>
              )}

            <div ref={chat.messagesEndRef} />
          </div>

          {/* Quick Actions - always visible when not loading */}
          {!chat.isLoading && (
            <div className="flex-shrink-0 px-3 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = ICON_MAP[action.icon] || Sparkles;
                  return (
                    <button
                      key={action.label}
                      onClick={() => chat.sendMessage(action.prompt)}
                      className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                    >
                      <Icon className="h-3 w-3" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 border-t border-border px-3 pb-3 pt-2">
            <div className="flex gap-2">
              <Textarea
                ref={chat.textareaRef}
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 'Add more detail to phase 2' or 'Break down task 3'"
                rows={2}
                disabled={chat.isLoading}
                className="min-h-[60px] flex-1 resize-none text-sm"
              />
              <Button
                onClick={() => chat.sendMessage()}
                disabled={!chat.input.trim() || chat.isLoading}
                size="sm"
                className="h-auto self-end"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-1.5 px-0.5 text-[10px] text-muted-foreground">
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Plan preview panel (always visible on desktop, tab on mobile) */}
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden',
            'lg:w-[200px] lg:flex-shrink-0',
            activePanel === 'preview' ? 'flex-1' : 'hidden lg:flex'
          )}
        >
          <div className="flex-shrink-0 border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Plan Structure
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {planPreview ? (
              planPreview.map((phase) => (
                <div key={phase.id}>
                  <button
                    onClick={() => togglePhase(phase.order)}
                    className="group flex w-full items-center gap-1 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-interactive"
                  >
                    {expandedPhases.has(phase.order) ? (
                      <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate text-[11px] font-medium">
                      {phase.title}
                    </span>
                    <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                      {phase.tasks.length}
                    </span>
                  </button>
                  {expandedPhases.has(phase.order) && (
                    <div className="ml-4 space-y-0.5 py-0.5">
                      {phase.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="truncate rounded px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          title={task.description}
                        >
                          {task.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-2 py-4 text-center text-[10px] text-muted-foreground">
                Loading plan...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  messageIdx,
  isLoading,
  onProposalAction,
  onAcceptAll,
  onApplyAccepted,
}: {
  message: ChatMessage;
  messageIdx: number;
  isLoading: boolean;
  onProposalAction: (
    msgIdx: number,
    proposalId: number,
    action: 'accepted' | 'rejected'
  ) => void;
  onAcceptAll: (msgIdx: number) => void;
  onApplyAccepted: (msgIdx: number) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col gap-1.5', isUser && 'items-end')}>
      <div
        className={cn(
          'max-w-[95%] rounded-xl px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted/60'
        )}
      >
        {message.content ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {renderMarkdownLight(message.content)}
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs">Analyzing plan...</span>
          </div>
        ) : null}
      </div>

      {message.proposals && message.proposals.length > 0 && (
        <ProposalList
          proposals={message.proposals}
          messageIdx={messageIdx}
          onAction={onProposalAction}
          onAcceptAll={onAcceptAll}
          onApplyAccepted={onApplyAccepted}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal List (Diff Cards)
// ---------------------------------------------------------------------------

function ProposalList({
  proposals,
  messageIdx,
  onAction,
  onAcceptAll,
  onApplyAccepted,
}: {
  proposals: Proposal[];
  messageIdx: number;
  onAction: (
    msgIdx: number,
    proposalId: number,
    action: 'accepted' | 'rejected'
  ) => void;
  onAcceptAll: (msgIdx: number) => void;
  onApplyAccepted: (msgIdx: number) => void;
}) {
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const acceptedCount = proposals.filter((p) => p.status === 'accepted').length;

  return (
    <div className="w-full space-y-2">
      {/* Bulk actions */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {proposals.length} suggested{' '}
          {proposals.length === 1 ? 'change' : 'changes'}
        </span>
        <div className="flex gap-1">
          {acceptedCount > 0 && (
            <Button
              size="sm"
              variant="default"
              className="h-6 px-2 text-[10px]"
              onClick={() => onApplyAccepted(messageIdx)}
            >
              <Check className="mr-1 h-2.5 w-2.5" />
              Apply {acceptedCount}
            </Button>
          )}
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onClick={() => onAcceptAll(messageIdx)}
            >
              <Sparkles className="mr-1 h-2.5 w-2.5" />
              Accept all
            </Button>
          )}
        </div>
      </div>

      {/* Individual proposals */}
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          onAccept={() => onAction(messageIdx, proposal.id, 'accepted')}
          onReject={() => onAction(messageIdx, proposal.id, 'rejected')}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal Card (Single Diff)
// ---------------------------------------------------------------------------

function ProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: Proposal;
  onAccept: () => void;
  onReject: () => void;
}) {
  const actionIcon = {
    update_phase: <Pencil className="h-3 w-3" />,
    update_task: <Pencil className="h-3 w-3" />,
    create_task: <Plus className="h-3 w-3" />,
    create_phase: <Plus className="h-3 w-3" />,
    delete_task: <Minus className="h-3 w-3" />,
  }[proposal.action] || <ChevronRight className="h-3 w-3" />;

  const actionColor =
    {
      update_phase: 'text-blue-400',
      update_task: 'text-blue-400',
      create_task: 'text-emerald-400',
      create_phase: 'text-emerald-400',
      delete_task: 'text-red-400',
    }[proposal.action] || 'text-muted-foreground';

  const isResolved = proposal.status !== 'pending';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        proposal.status === 'accepted' &&
          'border-emerald-500/30 bg-emerald-500/5',
        proposal.status === 'rejected' && 'opacity-40'
      )}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('flex-shrink-0', actionColor)}>{actionIcon}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {proposal.label}
          </span>
          {!isResolved && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={onAccept}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                title="Accept"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onReject}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {proposal.status === 'accepted' && (
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
          )}
        </div>

        {!isResolved && <DiffContent proposal={proposal} />}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Diff Content
// ---------------------------------------------------------------------------

function DiffContent({ proposal }: { proposal: Proposal }) {
  const before = proposal.before;
  const after = proposal.updates || proposal.task || proposal.phase;

  if (!after) return null;

  if (proposal.action === 'create_task' || proposal.action === 'create_phase') {
    const newItem = proposal.task || proposal.phase;
    if (!newItem) return null;
    return (
      <div className="mt-1.5 space-y-0.5 text-[11px]">
        <div className="flex items-start gap-1 text-emerald-400/80">
          <span className="flex-shrink-0 font-mono">+</span>
          <span className="font-medium">{newItem.title}</span>
        </div>
        {newItem.description && (
          <div className="flex items-start gap-1 pl-3 text-emerald-400/60">
            <span className="line-clamp-2">{newItem.description}</span>
          </div>
        )}
      </div>
    );
  }

  if (proposal.action === 'delete_task') {
    return (
      <div className="mt-1.5 space-y-0.5 text-[11px]">
        {before && (
          <div className="flex items-start gap-1 text-red-400/80">
            <span className="flex-shrink-0 font-mono">-</span>
            <span className="line-through">{before.title}</span>
          </div>
        )}
      </div>
    );
  }

  if (!before) return null;

  const updates = proposal.updates || {};
  const hasTitle = updates.title && updates.title !== before.title;
  const hasDesc =
    updates.description && updates.description !== before.description;

  if (!hasTitle && !hasDesc) return null;

  return (
    <div className="mt-1.5 space-y-1 font-mono text-[11px]">
      {hasTitle && (
        <div className="space-y-0.5">
          <div className="flex items-start gap-1 text-red-400/70">
            <span className="flex-shrink-0">-</span>
            <span className="line-through">{before.title}</span>
          </div>
          <div className="flex items-start gap-1 text-emerald-400/70">
            <span className="flex-shrink-0">+</span>
            <span>{updates.title}</span>
          </div>
        </div>
      )}
      {hasDesc && (
        <div className="space-y-0.5">
          <div className="flex items-start gap-1 text-red-400/60">
            <span className="flex-shrink-0">-</span>
            <span className="line-clamp-2 line-through">
              {before.description}
            </span>
          </div>
          <div className="flex items-start gap-1 text-emerald-400/60">
            <span className="flex-shrink-0">+</span>
            <span className="line-clamp-2">{updates.description}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple markdown-like rendering (bold only)
// ---------------------------------------------------------------------------

function renderMarkdownLight(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
