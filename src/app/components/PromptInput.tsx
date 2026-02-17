'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  Loader2,
  Send,
  ChevronDown,
  Clock,
  FileText,
  Paperclip,
  X,
  Upload,
  Hash,
  Sparkles,
  Zap,
  Bug,
  RefreshCw,
  TestTube,
  BookOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu';

interface PromptInputProps {
  sessionId: string;
  onTaskCreated?: (taskId: string) => void;
}

interface Attachment {
  name: string;
  size: number;
  type: string;
}

interface PromptTemplate {
  label: string;
  description: string;
  template: string;
  icon: React.ReactNode;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: 'Add feature',
    description: 'Implement a new feature',
    template: 'Add a new feature: ',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    label: 'Fix bug',
    description: 'Debug and fix an issue',
    template: 'Fix the bug where ',
    icon: <Bug className="h-4 w-4" />,
  },
  {
    label: 'Refactor',
    description: 'Improve existing code',
    template: 'Refactor the following to improve ',
    icon: <RefreshCw className="h-4 w-4" />,
  },
  {
    label: 'Add tests',
    description: 'Write tests for existing code',
    template: 'Write tests for ',
    icon: <TestTube className="h-4 w-4" />,
  },
  {
    label: 'Documentation',
    description: 'Add or update docs',
    template: 'Add documentation for ',
    icon: <BookOpen className="h-4 w-4" />,
  },
];

const RECENT_PROMPTS_KEY = 'forge-recent-prompts';
const MAX_RECENT_PROMPTS = 5;
const MAX_TEXTAREA_HEIGHT = 300;
const MIN_TEXTAREA_HEIGHT = 56;

function getRecentPrompts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_PROMPTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentPrompt(prompt: string) {
  if (typeof window === 'undefined') return;
  try {
    const prompts = getRecentPrompts();
    const filtered = prompts.filter((p) => p !== prompt);
    filtered.unshift(prompt);
    localStorage.setItem(
      RECENT_PROMPTS_KEY,
      JSON.stringify(filtered.slice(0, MAX_RECENT_PROMPTS))
    );
  } catch {
    // localStorage unavailable
  }
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PromptInput({ sessionId, onTaskCreated }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Load recent prompts on mount
  useEffect(() => {
    setRecentPrompts(getRecentPrompts());
  }, []);

  // Auto-resize textarea as content grows
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt, adjustTextareaHeight]);

  const charCount = prompt.length;
  const tokenEstimate = useMemo(() => estimateTokens(prompt), [prompt]);

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.platform.includes('Mac');
  }, []);

  const modKey = isMac ? '⌘' : 'Ctrl';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          prompt: prompt.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }

      const data = await res.json();

      // Save to recent prompts
      saveRecentPrompt(prompt.trim());
      setRecentPrompts(getRecentPrompts());

      // Clear state
      setPrompt('');
      setAttachments([]);

      // Notify parent
      if (onTaskCreated) {
        onTaskCreated(data.task.id);
      }
    } catch (err) {
      console.error('Failed to submit prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit prompt');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function insertTemplate(template: string) {
    setPrompt(template);
    textareaRef.current?.focus();
    // Place cursor at end
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = template.length;
      }
    }, 0);
  }

  function selectRecentPrompt(recentPrompt: string) {
    setPrompt(recentPrompt);
    textareaRef.current?.focus();
  }

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }

  function addFiles(files: File[]) {
    const newAttachments: Attachment[] = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  const hasContent = prompt.trim().length > 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="relative">
      <div
        className={cn(
          'relative rounded-xl border-2 bg-card transition-all duration-200',
          isFocused
            ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]'
            : 'border-border hover:border-primary/40',
          isDragOver && 'border-dashed border-primary bg-primary/5',
          isSubmitting && 'opacity-80',
          error &&
            'border-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.1)]'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Floating label */}
        <div
          className={cn(
            'pointer-events-none absolute left-4 z-10 transition-all duration-200',
            hasContent || isFocused
              ? '-top-2.5 bg-card px-1.5 text-xs'
              : 'top-4 text-sm'
          )}
        >
          <span
            className={cn(
              'transition-colors duration-200',
              isFocused ? 'font-medium text-primary' : 'text-muted-foreground'
            )}
          >
            What should Claude do?
          </span>
        </div>

        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-primary/5">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Drop files to attach</span>
            </div>
          </div>
        )}

        {/* Toolbar row */}
        <div className="flex items-center gap-1 px-2 pb-0 pt-2">
          {/* Templates dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Templates</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Quick templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PROMPT_TEMPLATES.map((t) => (
                <DropdownMenuItem
                  key={t.label}
                  onClick={() => insertTemplate(t.template)}
                  className="cursor-pointer gap-2"
                >
                  {t.icon}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Recent prompts dropdown */}
          {recentPrompts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Recent</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel>Recent prompts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {recentPrompts.map((rp, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={() => selectRecentPrompt(rp)}
                    className="cursor-pointer"
                  >
                    <span className="truncate text-sm">{rp}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* File attachment button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Attach</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Markdown hint */}
          <div
            className="mr-1 hidden items-center gap-1 text-xs text-muted-foreground/60 sm:flex"
            title="Markdown formatting is supported"
          >
            <Hash className="h-3 w-3" />
            <span>Markdown</span>
          </div>
        </div>

        {/* Expandable textarea */}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Describe the task, feature, or bug fix..."
          className={cn(
            'w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground/50',
            'resize-none text-sm leading-relaxed focus:outline-none',
            'scrollbar-hide'
          )}
          style={{
            minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
            maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
          }}
          disabled={isSubmitting}
          autoFocus
        />

        {/* Attachments list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="max-w-[120px] truncate">{att.name}</span>
                <span className="text-muted-foreground">
                  {formatFileSize(att.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 transition-colors hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mx-4 mb-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Bottom bar: counts + submit */}
        <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
          {/* Character / token count */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
            <span>{charCount} chars</span>
            <span className="hidden sm:inline">~{tokenEstimate} tokens</span>
          </div>

          {/* Submit area */}
          <div className="flex items-center gap-2">
            <kbd className="hidden items-center gap-0.5 rounded border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
              {modKey} + ↵
            </kbd>
            <Button
              type="submit"
              disabled={isSubmitting || !hasContent}
              size="sm"
              className={cn(
                'h-8 gap-1.5 px-4 transition-all duration-200',
                hasContent && !isSubmitting
                  ? 'bg-primary shadow-sm hover:bg-primary/90'
                  : ''
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
