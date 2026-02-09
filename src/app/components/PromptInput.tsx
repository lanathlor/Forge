'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Loader2, Send, Sparkles } from 'lucide-react';

interface PromptInputProps {
  sessionId: string;
  onTaskCreated?: (taskId: string) => void;
}

/**
 * Prompt Input Component
 * Allows users to submit prompts to Claude for execution
 * Features:
 * - Large textarea for prompt input
 * - Submit button with loading state
 * - Keyboard shortcuts (Cmd/Ctrl + Enter to submit)
 * - Auto-focus on mount
 * - Mobile-responsive
 */
/* eslint-disable max-lines-per-function */
export function PromptInput({ sessionId, onTaskCreated }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log('[PromptInput] Submit clicked, sessionId:', sessionId, 'prompt:', prompt.substring(0, 50));

    if (!prompt.trim()) {
      console.log('[PromptInput] Empty prompt, showing error');
      setError('Please enter a prompt');
      return;
    }

    if (!sessionId) {
      console.error('[PromptInput] No sessionId!');
      setError('No active session. Please select a repository first.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      console.log('[PromptInput] Sending POST to /api/tasks');
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          prompt: prompt.trim(),
        }),
      });

      console.log('[PromptInput] Response status:', res.status);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }

      const data = await res.json();
      console.log('[PromptInput] Task created:', data.task.id);

      // Clear prompt on success
      setPrompt('');

      // Notify parent
      if (onTaskCreated) {
        onTaskCreated(data.task.id);
      }
    } catch (err) {
      console.error('[PromptInput] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit prompt');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base sm:text-lg font-semibold">
              What would you like Claude to do?
            </h3>
          </div>

          {/* Textarea */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Example: Add a new API endpoint for user authentication with JWT tokens..."
            className="w-full min-h-[120px] sm:min-h-[150px] p-3 sm:p-4 border rounded-lg bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
            disabled={isSubmitting}
            autoFocus
          />

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Tip: Press{' '}
              <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs">
                {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
              </kbd>{' '}
              +{' '}
              <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs">
                Enter
              </kbd>{' '}
              to submit
            </p>

            <Button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className="gap-2"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Sending to Claude...</span>
                  <span className="sm:hidden">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send to Claude</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
