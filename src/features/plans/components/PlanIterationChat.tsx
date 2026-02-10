'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useGetPlanQuery } from '../store/plansApi';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';

interface PlanIterationChatProps {
  planId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function PlanIterationChat({
  planId,
  open,
  onOpenChange,
}: PlanIterationChatProps) {
  const { data, refetch } = useGetPlanQuery(planId!, { skip: !planId });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [changesCount, setChangesCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && data) {
      // Initialize with a welcome message
      setMessages([
        {
          role: 'assistant',
          content: `I'm ready to help you iterate on "${data.plan.title}". You can ask me to:\n\n• Refine or expand any phase or task descriptions\n• Add missing steps or tasks\n• Reorganize phases or tasks\n• Break down complex tasks into smaller steps\n• Add error handling or edge cases\n\nJust tell me what you'd like to change in plain English!`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [open, data]);

  const handleSendMessage = async () => {
    if (!input.trim() || !planId || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add a placeholder message for the assistant response
    const assistantMessageId = Date.now();
    const assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(`/api/plans/${planId}/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let updated = false;
      let updateSummary = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                // Append the chunk to the assistant message in real-time
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content += data.content;
                  }
                  return newMessages;
                });
              } else if (data.type === 'status') {
                // You can optionally show status messages
                console.log('[PlanIterationChat] Status:', data.message);
              } else if (data.type === 'updated') {
                updated = data.value;
                updateSummary = data.summary || '';
              } else if (data.type === 'error') {
                console.error('[PlanIterationChat] Server error:', data.message);
                throw new Error(data.message);
              }
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : 'Unknown error';
              console.error('[PlanIterationChat] Failed to parse SSE data:', errorMsg);
              throw e;
            }
          }
        }
      }

      // If there were changes made, refetch the plan to show updates
      if (updated) {
        console.log('[PlanIterationChat] Plan was updated, refetching...');
        setChangesCount((prev) => prev + 1);

        // Wait a bit to ensure DB has been updated
        await new Promise(resolve => setTimeout(resolve, 500));
        const result = await refetch();
        console.log('[PlanIterationChat] Refetch result:', result.isSuccess ? 'success' : 'failed');

        // Clean up and add the checkmark message
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            // Remove the <UPDATES> section from display
            const cleanContent = lastMessage.content.replace(/<UPDATES>[\s\S]*?<\/UPDATES>/, '').trim();
            const summaryText = updateSummary
              ? `\n\n✅ **Changes applied:** ${updateSummary}\n\n💡 Close this dialog to see the updated plan!`
              : '\n\n✅ I\'ve updated the plan!\n\n💡 Close this dialog to see the changes!';
            lastMessage.content = cleanContent + summaryText;
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorDetails = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          if (!lastMessage.content) {
            lastMessage.content = `Sorry, I encountered an error: ${errorDetails}\n\nPlease try again or rephrase your request.`;
          } else {
            // Clean up any partial <UPDATES> section in case of error
            const cleanContent = lastMessage.content.replace(/<UPDATES>[\s\S]*?<\/UPDATES>/, '').trim();
            lastMessage.content = cleanContent;
          }
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Iterate on Plan with Claude</DialogTitle>
              <DialogDescription>
                Have a conversation with Claude to refine and improve your plan
              </DialogDescription>
            </div>
            {changesCount > 0 && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {changesCount} {changesCount === 1 ? 'change' : 'changes'} applied
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 min-h-[400px]">
          {messages.map((message, idx) => (
            <Card
              key={idx}
              className={`p-4 ${
                message.role === 'user'
                  ? 'bg-primary/10 ml-8'
                  : 'bg-accent mr-8'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 font-semibold text-sm">
                  {message.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className="flex-1 text-sm whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2 text-right">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </Card>
          ))}
          {isLoading && (
            <Card className="p-4 bg-accent mr-8">
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Claude is thinking...
                </span>
              </div>
            </Card>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Claude what you'd like to change... (Shift+Enter for new line)"
            rows={3}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            size="lg"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
