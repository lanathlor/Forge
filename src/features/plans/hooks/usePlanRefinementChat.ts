/* eslint-disable max-lines-per-function, complexity */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGetPlanQuery } from '../store/plansApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Proposal {
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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  proposals?: Proposal[];
}

export interface QuickAction {
  label: string;
  prompt: string;
  icon: string; // icon name string, component maps it
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Add detail',
    icon: 'list-plus',
    prompt:
      'Add more detail to all phases and tasks. Make descriptions more specific and actionable.',
  },
  {
    label: 'Simplify',
    icon: 'minimize',
    prompt:
      'Simplify the plan. Merge redundant tasks, remove unnecessary steps, and make it more concise.',
  },
  {
    label: 'Add tests',
    icon: 'shield',
    prompt:
      'Add testing tasks to each phase. Include unit tests, integration tests, and any relevant E2E tests.',
  },
  {
    label: 'Error handling',
    icon: 'bug',
    prompt:
      'Add error handling and edge case tasks. Consider failure modes, validation, and recovery steps.',
  },
];

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

type SetMessages = React.Dispatch<React.SetStateAction<ChatMessage[]>>;

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

async function streamRefinement(
  planId: string,
  text: string,
  messages: ChatMessage[],
  setMessages: SetMessages
): Promise<Proposal[]> {
  const response = await fetch(`/api/plans/${planId}/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      conversationHistory: messages
        .filter((m) => !m.proposals)
        .map(({ role, content }) => ({ role, content })),
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
        proposals = (parsed.changes as Proposal[]).map((p) => ({
          ...p,
          status: 'pending' as const,
        }));
      } else if (parsed.type === 'error') {
        throw new Error(parsed.message as string);
      }
    }
  }

  return proposals;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePlanRefinementChat(planId: string, enabled: boolean) {
  const { data: planData, refetch } = useGetPlanQuery(planId, {
    skip: !planId || !enabled,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalApplied, setTotalApplied] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize welcome message when opened
  useEffect(() => {
    if (enabled && planData && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Ready to refine **"${planData.plan.title}"**. Tell me what to change, or use a quick action below.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [enabled, planData, messages.length]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea
  useEffect(() => {
    if (enabled) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [enabled]);

  // Send a message
  const sendMessage = useCallback(
    async (messageText?: string) => {
      const text = messageText || input.trim();
      if (!text || !planId || isLoading) return;

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: text, timestamp: new Date() },
      ]);
      if (!messageText) setInput('');
      setIsLoading(true);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', timestamp: new Date() },
      ]);

      try {
        const proposals = await streamRefinement(
          planId,
          text,
          messages,
          setMessages
        );
        // Finalize: clean up <UPDATES> tags and attach proposals
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            last.content = last.content
              .replace(/<UPDATES>[\s\S]*?<\/UPDATES>/, '')
              .trim();
            if (proposals.length > 0) last.proposals = proposals;
          }
          return updated;
        });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            last.content =
              last.content || `Sorry, something went wrong: ${errorMsg}`;
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [input, planId, isLoading, messages]
  );

  // Accept/reject individual proposals
  const setProposalStatus = useCallback(
    (
      messageIdx: number,
      proposalId: number,
      status: 'accepted' | 'rejected'
    ) => {
      setMessages((prev) => {
        const updated = [...prev];
        const msg = updated[messageIdx];
        if (msg?.proposals) {
          const proposal = msg.proposals.find((p) => p.id === proposalId);
          if (proposal) proposal.status = status;
        }
        return [...updated];
      });
    },
    []
  );

  // Apply accepted proposals for a message
  const applyAccepted = useCallback(
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

        // Remove applied proposals
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

  // Accept all pending and apply at once
  const acceptAllAndApply = useCallback(
    async (messageIdx: number) => {
      const msg = messages[messageIdx];
      if (!msg?.proposals) return;

      const allChanges = msg.proposals.filter(
        (p) => p.status === 'pending' || p.status === 'accepted'
      );
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

        // Clear proposals and add confirmation
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

  // Reset chat state (for closing/reopening)
  const resetChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setTotalApplied(0);
  }, []);

  return {
    // Plan data
    planData,
    refetchPlan: refetch,

    // Chat state
    messages,
    input,
    setInput,
    isLoading,
    totalApplied,

    // Refs
    messagesEndRef,
    textareaRef,

    // Actions
    sendMessage,
    setProposalStatus,
    applyAccepted,
    acceptAllAndApply,
    resetChat,
  };
}
