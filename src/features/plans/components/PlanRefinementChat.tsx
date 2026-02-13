'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { useGetPlanQuery } from '../store/plansApi';
import { cn } from '@/shared/lib/utils';
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
  ListPlus,
  Minimize2,
  Shield,
  Bug,
  Wand2,
  Play,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanRefinementChatProps {
  planId: string;
  open: boolean;
  onClose: () => void;
  onLaunch?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposals?: Proposal[];
}

interface Proposal {
  id: number;
  action: string;
  phaseOrder?: number;
  taskOrder?: number;
  updates?: Record<string, string>;
  task?: { title: string; description: string };
  phase?: { title: string; description: string };
  label: string;
  before?: { title: string; description: string } | null;
  status: 'pending' | 'accepted' | 'rejected';
}

const QUICK_ACTIONS = [
  { label: 'Add detail', icon: ListPlus, prompt: 'Add more detail to all phases and tasks. Make descriptions more specific and actionable.' },
  { label: 'Simplify', icon: Minimize2, prompt: 'Simplify the plan. Merge redundant tasks, remove unnecessary steps, and make it more concise.' },
  { label: 'Add tests', icon: Shield, prompt: 'Add testing tasks to each phase. Include unit tests, integration tests, and any relevant E2E tests.' },
  { label: 'Error handling', icon: Bug, prompt: 'Add error handling and edge case tasks. Consider failure modes, validation, and recovery steps.' },
];

// ---------------------------------------------------------------------------
// SSE stream helpers
// ---------------------------------------------------------------------------

type SetMessages = React.Dispatch<React.SetStateAction<Message[]>>;

async function streamRefinement(
  planId: string,
  text: string,
  messages: Message[],
  setMessages: SetMessages,
): Promise<Proposal[]> {
  const response = await fetch(`/api/plans/${planId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      conversationHistory: messages.filter((m) => !m.proposals),
    }),
  });

  if (!response.ok) throw new Error('Failed to get response');

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No response body');

  let proposals: Proposal[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const parsed = parseSseLine(line);
      if (!parsed) continue;

      if (parsed.type === 'chunk') {
        appendToLastAssistant(setMessages, parsed.content as string);
      } else if (parsed.type === 'proposals') {
        proposals = (parsed.changes as Proposal[]).map((p) => ({ ...p, status: 'pending' as const }));
      } else if (parsed.type === 'error') {
        throw new Error(parsed.message as string);
      }
    }
  }

  return proposals;
}

function parseSseLine(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

function appendToLastAssistant(setMessages: SetMessages, content: string) {
  setMessages((prev) => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    if (last?.role === 'assistant') last.content += content;
    return updated;
  });
}

function finalizeAssistantMessage(setMessages: SetMessages, proposals: Proposal[]) {
  setMessages((prev) => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    if (last?.role === 'assistant') {
      last.content = last.content.replace(/<UPDATES>[\s\S]*?<\/UPDATES>/, '').trim();
      if (proposals.length > 0) last.proposals = proposals;
    }
    return updated;
  });
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
  const { data, refetch } = useGetPlanQuery(planId, { skip: !planId });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalApplied, setTotalApplied] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize welcome message
  useEffect(() => {
    if (open && data && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Ready to refine **"${data.plan.title}"**. Tell me what to change, or use a quick action below.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, data, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || !planId || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    if (!messageText) setInput('');
    setIsLoading(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const proposals = await streamRefinement(planId, text, messages, setMessages);
      finalizeAssistantMessage(setMessages, proposals);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          last.content = last.content || `Sorry, something went wrong: ${errorMsg}`;
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, planId, isLoading, messages]);

  // Accept/reject individual proposals
  const handleProposalAction = useCallback(
    (messageIdx: number, proposalId: number, action: 'accepted' | 'rejected') => {
      setMessages((prev) => {
        const updated = [...prev];
        const msg = updated[messageIdx];
        if (msg?.proposals) {
          const proposal = msg.proposals.find((p) => p.id === proposalId);
          if (proposal) {
            proposal.status = action;
          }
        }
        return [...updated];
      });
    },
    []
  );

  // Apply all accepted proposals for a message
  const handleApplyAccepted = useCallback(
    async (messageIdx: number) => {
      const msg = messages[messageIdx];
      if (!msg?.proposals) return;

      const accepted = msg.proposals.filter((p) => p.status === 'accepted');
      if (accepted.length === 0) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/plans/${planId}/refine/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changes: accepted,
            prompt: messages[messageIdx - 1]?.content || 'Refinement',
          }),
        });

        if (!response.ok) throw new Error('Failed to apply changes');

        const result = await response.json();
        setTotalApplied((prev) => prev + result.applied);

        // Mark all as applied
        setMessages((prev) => {
          const updated = [...prev];
          const m = updated[messageIdx];
          if (m?.proposals) {
            m.proposals = m.proposals.filter((p) => p.status !== 'accepted');
          }
          return updated;
        });

        await refetch();
      } catch (error) {
        console.error('Failed to apply changes:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, planId, refetch]
  );

  // Accept all and apply at once
  const handleAcceptAll = useCallback(
    async (messageIdx: number) => {
      const msg = messages[messageIdx];
      if (!msg?.proposals) return;

      // Mark all pending as accepted
      const allChanges = msg.proposals.filter((p) => p.status === 'pending' || p.status === 'accepted');
      if (allChanges.length === 0) return;

      setIsLoading(true);
      try {
        const response = await fetch(`/api/plans/${planId}/refine/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changes: allChanges,
            prompt: messages[messageIdx - 1]?.content || 'Refinement',
          }),
        });

        if (!response.ok) throw new Error('Failed to apply changes');

        const result = await response.json();
        setTotalApplied((prev) => prev + result.applied);

        // Clear proposals
        setMessages((prev) => {
          const updated = [...prev];
          const m = updated[messageIdx];
          if (m) {
            m.proposals = undefined;
            m.content += `\n\n**${result.applied} changes applied.**`;
          }
          return updated;
        });

        await refetch();
      } catch (error) {
        console.error('Failed to apply changes:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, planId, refetch]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        'flex flex-col bg-card border-l border-border',
        // Desktop: side panel
        'lg:relative lg:w-[420px] lg:flex-shrink-0',
        // Mobile: full-screen overlay
        'fixed inset-0 z-50 lg:static lg:z-auto'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Wand2 className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="font-medium text-sm truncate">Refine Plan</span>
          {totalApplied > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {totalApplied}
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
              <Play className="h-3 w-3 mr-1" />
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((message, idx) => (
          <MessageBubble
            key={idx}
            message={message}
            messageIdx={idx}
            isLoading={isLoading && idx === messages.length - 1 && message.role === 'assistant'}
            onProposalAction={handleProposalAction}
            onAcceptAll={handleAcceptAll}
            onApplyAccepted={handleApplyAccepted}
          />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {!isLoading && messages.length <= 2 && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSend(action.prompt)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Refine the plan..."
            rows={2}
            disabled={isLoading}
            className="flex-1 text-sm resize-none min-h-[60px]"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="h-auto self-end"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
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
  message: Message;
  messageIdx: number;
  isLoading: boolean;
  onProposalAction: (msgIdx: number, proposalId: number, action: 'accepted' | 'rejected') => void;
  onAcceptAll: (msgIdx: number) => void;
  onApplyAccepted: (msgIdx: number) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col gap-1.5', isUser && 'items-end')}>
      {/* Message bubble */}
      <div
        className={cn(
          'rounded-xl px-3 py-2 text-sm max-w-[95%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/60'
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

      {/* Proposals (diff cards) */}
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

  const actionColor = {
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
        proposal.status === 'rejected' && 'opacity-40'
      )}
    >
      <div className="px-3 py-2">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span className={cn('flex-shrink-0', actionColor)}>{actionIcon}</span>
          <span className="text-xs font-medium flex-1 min-w-0 truncate">
            {proposal.label}
          </span>
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

        {/* Diff content */}
        {!isResolved && (
          <DiffContent proposal={proposal} />
        )}
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

  // For create actions, only show the new content
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

  // For delete actions, show the removed content
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

  // For updates, show before -> after
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
