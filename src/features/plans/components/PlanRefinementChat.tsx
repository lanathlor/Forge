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
        'flex flex-col bg-card border-l border-border',
        'lg:relative lg:w-[460px] lg:flex-shrink-0',
        'fixed inset-0 z-50 lg:static lg:z-auto',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Wand2 className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="font-medium text-sm truncate">Refine Plan</span>
          {chat.totalApplied > 0 && (
            <Badge
              variant="default"
              className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              {chat.totalApplied}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onLaunch && (
            <Button size="sm" variant="default" className="h-7 text-xs" onClick={onLaunch}>
              <Play className="h-3 w-3 mr-1" />
              Launch
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile panel toggle */}
      <div className="flex lg:hidden border-b border-border flex-shrink-0">
        <button
          onClick={() => setActivePanel('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activePanel === 'chat'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground',
          )}
        >
          <MessageSquare className="h-3 w-3" />
          Chat
        </button>
        <button
          onClick={() => setActivePanel('preview')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
            activePanel === 'preview'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground',
          )}
        >
          <Eye className="h-3 w-3" />
          Plan Preview
        </button>
      </div>

      {/* Content area: split on desktop, tabbed on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Chat panel */}
        <div
          className={cn(
            'flex flex-col min-h-0',
            'lg:flex-1 lg:border-r lg:border-border',
            activePanel === 'chat' ? 'flex-1' : 'hidden lg:flex',
          )}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {chat.messages.map((message, idx) => (
              <MessageBubble
                key={idx}
                message={message}
                messageIdx={idx}
                isLoading={
                  chat.isLoading && idx === chat.messages.length - 1 && message.role === 'assistant'
                }
                onProposalAction={chat.setProposalStatus}
                onAcceptAll={chat.acceptAllAndApply}
                onApplyAccepted={chat.applyAccepted}
              />
            ))}

            {chat.isLoading && chat.messages[chat.messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </div>
            )}

            <div ref={chat.messagesEndRef} />
          </div>

          {/* Quick Actions - always visible when not loading */}
          {!chat.isLoading && (
            <div className="px-3 pb-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = ICON_MAP[action.icon] || Sparkles;
                  return (
                    <button
                      key={action.label}
                      onClick={() => chat.sendMessage(action.prompt)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
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
          <div className="px-3 pb-3 pt-2 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                ref={chat.textareaRef}
                value={chat.input}
                onChange={(e) => chat.setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 'Add more detail to phase 2' or 'Break down task 3'"
                rows={2}
                disabled={chat.isLoading}
                className="flex-1 text-sm resize-none min-h-[60px]"
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
            <p className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Plan preview panel (always visible on desktop, tab on mobile) */}
        <div
          className={cn(
            'flex flex-col min-h-0 overflow-hidden',
            'lg:w-[200px] lg:flex-shrink-0',
            activePanel === 'preview' ? 'flex-1' : 'hidden lg:flex',
          )}
        >
          <div className="px-3 py-2 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Plan Structure
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {planPreview ? (
              planPreview.map((phase) => (
                <div key={phase.id}>
                  <button
                    onClick={() => togglePhase(phase.order)}
                    className="w-full flex items-center gap-1 px-1.5 py-1 rounded text-left hover:bg-surface-interactive transition-colors group"
                  >
                    {expandedPhases.has(phase.order) ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-[11px] font-medium truncate flex-1">{phase.title}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {phase.tasks.length}
                    </span>
                  </button>
                  {expandedPhases.has(phase.order) && (
                    <div className="ml-4 space-y-0.5 py-0.5">
                      {phase.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded truncate"
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
              <div className="text-[10px] text-muted-foreground px-2 py-4 text-center">
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
  onProposalAction: (msgIdx: number, proposalId: number, action: 'accepted' | 'rejected') => void;
  onAcceptAll: (msgIdx: number) => void;
  onApplyAccepted: (msgIdx: number) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col gap-1.5', isUser && 'items-end')}>
      <div
        className={cn(
          'rounded-xl px-3 py-2 text-sm max-w-[95%]',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted/60',
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
  onAction: (msgIdx: number, proposalId: number, action: 'accepted' | 'rejected') => void;
  onAcceptAll: (msgIdx: number) => void;
  onApplyAccepted: (msgIdx: number) => void;
}) {
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const acceptedCount = proposals.filter((p) => p.status === 'accepted').length;

  return (
    <div className="w-full space-y-2">
      {/* Bulk actions */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {proposals.length} suggested {proposals.length === 1 ? 'change' : 'changes'}
        </span>
        <div className="flex gap-1">
          {acceptedCount > 0 && (
            <Button
              size="sm"
              variant="default"
              className="h-6 text-[10px] px-2"
              onClick={() => onApplyAccepted(messageIdx)}
            >
              <Check className="h-2.5 w-2.5 mr-1" />
              Apply {acceptedCount}
            </Button>
          )}
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onAcceptAll(messageIdx)}
            >
              <Sparkles className="h-2.5 w-2.5 mr-1" />
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
        proposal.status === 'accepted' && 'border-emerald-500/30 bg-emerald-500/5',
        proposal.status === 'rejected' && 'opacity-40',
      )}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('flex-shrink-0', actionColor)}>{actionIcon}</span>
          <span className="text-xs font-medium flex-1 min-w-0 truncate">{proposal.label}</span>
          {!isResolved && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onAccept}
                className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors"
                title="Accept"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onReject}
                className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {proposal.status === 'accepted' && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
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
      <div className="mt-1.5 text-[11px] space-y-0.5">
        <div className="text-emerald-400/80 flex items-start gap-1">
          <span className="flex-shrink-0 font-mono">+</span>
          <span className="font-medium">{newItem.title}</span>
        </div>
        {newItem.description && (
          <div className="text-emerald-400/60 flex items-start gap-1 pl-3">
            <span className="line-clamp-2">{newItem.description}</span>
          </div>
        )}
      </div>
    );
  }

  if (proposal.action === 'delete_task') {
    return (
      <div className="mt-1.5 text-[11px] space-y-0.5">
        {before && (
          <div className="text-red-400/80 flex items-start gap-1">
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
  const hasDesc = updates.description && updates.description !== before.description;

  if (!hasTitle && !hasDesc) return null;

  return (
    <div className="mt-1.5 text-[11px] space-y-1 font-mono">
      {hasTitle && (
        <div className="space-y-0.5">
          <div className="text-red-400/70 flex items-start gap-1">
            <span className="flex-shrink-0">-</span>
            <span className="line-through">{before.title}</span>
          </div>
          <div className="text-emerald-400/70 flex items-start gap-1">
            <span className="flex-shrink-0">+</span>
            <span>{updates.title}</span>
          </div>
        </div>
      )}
      {hasDesc && (
        <div className="space-y-0.5">
          <div className="text-red-400/60 flex items-start gap-1">
            <span className="flex-shrink-0">-</span>
            <span className="line-clamp-2 line-through">{before.description}</span>
          </div>
          <div className="text-emerald-400/60 flex items-start gap-1">
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
