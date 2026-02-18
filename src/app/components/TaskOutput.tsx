'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  ArrowDown,
  Loader2,
  Terminal,
  Radio,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskOutputProps {
  output: string;
  status: string;
}

interface ParsedBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
  id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STREAMING_STATUSES = ['running', 'qa_running', 'pre_flight'];

// Simple keyword sets for lightweight highlighting
const KEYWORDS: Record<string, Set<string>> = {
  js: new Set([
    'const',
    'let',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'class',
    'extends',
    'new',
    'this',
    'super',
    'import',
    'export',
    'default',
    'from',
    'async',
    'await',
    'try',
    'catch',
    'finally',
    'throw',
    'typeof',
    'instanceof',
    'in',
    'of',
    'true',
    'false',
    'null',
    'undefined',
    'yield',
    'delete',
    'void',
  ]),
  py: new Set([
    'def',
    'class',
    'return',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'with',
    'as',
    'import',
    'from',
    'try',
    'except',
    'finally',
    'raise',
    'pass',
    'break',
    'continue',
    'and',
    'or',
    'not',
    'in',
    'is',
    'True',
    'False',
    'None',
    'lambda',
    'yield',
    'global',
    'nonlocal',
    'del',
    'assert',
  ]),
  sh: new Set([
    'if',
    'then',
    'else',
    'elif',
    'fi',
    'for',
    'do',
    'done',
    'while',
    'until',
    'case',
    'esac',
    'function',
    'return',
    'exit',
    'export',
    'local',
    'readonly',
    'shift',
    'set',
    'unset',
    'echo',
    'printf',
  ]),
};

const LANG_ALIASES: Record<string, string> = {
  javascript: 'js',
  typescript: 'js',
  jsx: 'js',
  tsx: 'js',
  ts: 'js',
  python: 'py',
  bash: 'sh',
  shell: 'sh',
  zsh: 'sh',
  go: 'js',
  rust: 'js',
  java: 'js',
  c: 'js',
  cpp: 'js',
  'c++': 'js',
  json: 'json',
  yaml: 'json',
  yml: 'json',
  toml: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  html: 'html',
  xml: 'html',
  svg: 'html',
  sql: 'sql',
  graphql: 'sql',
  markdown: 'md',
  md: 'md',
};

// ---------------------------------------------------------------------------
// Syntax Highlighting (lightweight, no external deps)
// ---------------------------------------------------------------------------

function highlightLine(line: string, langKey: string): ReactNode[] {
  const kws = KEYWORDS[langKey];
  if (!kws) return [line];

  // Tokenize with a simple regex
  const tokens: ReactNode[] = [];
  // Match: strings, comments, numbers, words, whitespace, other
  const pattern =
    /(\/\/.*$|#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_$][\w$]*\b|\s+|.)/gm;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(line)) !== null) {
    const token = match[0];
    const key = `${idx++}`;

    // Comment
    if (token.startsWith('//') || token.startsWith('#')) {
      tokens.push(
        <span
          key={key}
          className="italic text-emerald-600 dark:text-emerald-400"
        >
          {token}
        </span>
      );
    }
    // String
    else if (
      (token.startsWith('"') ||
        token.startsWith("'") ||
        token.startsWith('`')) &&
      token.length > 1
    ) {
      tokens.push(
        <span key={key} className="text-amber-600 dark:text-amber-400">
          {token}
        </span>
      );
    }
    // Number
    else if (/^\d/.test(token)) {
      tokens.push(
        <span key={key} className="text-purple-600 dark:text-purple-400">
          {token}
        </span>
      );
    }
    // Keyword
    else if (kws.has(token)) {
      tokens.push(
        <span
          key={key}
          className="font-medium text-blue-600 dark:text-blue-400"
        >
          {token}
        </span>
      );
    }
    // Default
    else {
      tokens.push(<span key={key}>{token}</span>);
    }
  }

  return tokens.length > 0 ? tokens : [line];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-all',
        'hover:bg-muted hover:text-foreground',
        'focus:outline-none focus:ring-1 focus:ring-ring',
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:bg-red-500/20 dark:text-red-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-red-500" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
      Live
    </span>
  );
}

function StreamingCursor() {
  return (
    <span className="ml-0.5 inline-block h-[14px] w-[7px] animate-cursor-blink rounded-[1px] bg-foreground/70 align-text-bottom" />
  );
}

function ScrollToBottomButton({
  onClick,
  visible,
}: {
  onClick: () => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      className={cn(
        'absolute bottom-4 right-4 z-10',
        'flex items-center gap-1.5 rounded-full px-3 py-1.5',
        'bg-primary text-primary-foreground shadow-lg',
        'text-xs font-medium',
        'transition-all hover:bg-primary/90',
        'duration-200 animate-in fade-in slide-in-from-bottom-2'
      )}
    >
      <ArrowDown className="h-3 w-3" />
      Latest
    </button>
  );
}

// ---------------------------------------------------------------------------
// Code Block
// ---------------------------------------------------------------------------

function CodeBlock({
  content,
  language,
  isStreaming,
  searchQuery,
}: {
  content: string;
  language?: string;
  isStreaming: boolean;
  searchQuery: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lines = content.split('\n');
  const lineCount = lines.length;
  const langKey = language
    ? LANG_ALIASES[language.toLowerCase()] || language.toLowerCase()
    : '';
  const isLong = lineCount > 25;

  return (
    <div
      className={cn(
        'my-2 overflow-hidden rounded-lg border',
        'bg-slate-950 dark:bg-black/40',
        isStreaming && 'animate-stream-glow'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-3 py-1.5 dark:bg-white/5">
        <div className="flex items-center gap-2">
          {isLong && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded p-0.5 text-slate-400 transition-colors hover:bg-white/10"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
            {language || 'code'}
          </span>
          <span className="text-[10px] text-slate-500">
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
        </div>
        <CopyButton
          text={content}
          className="text-slate-400 hover:bg-white/10 hover:text-slate-200"
        />
      </div>

      {/* Code content */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <pre className="p-3 text-[13px] leading-relaxed">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="w-8 flex-shrink-0 select-none pr-3 text-right text-[11px] leading-relaxed text-slate-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-200">
                    {searchQuery
                      ? highlightSearchInLine(line, searchQuery)
                      : kws(langKey)
                        ? highlightLine(line, langKey)
                        : line}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      )}

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full py-2 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
        >
          Show {lineCount} lines
        </button>
      )}
    </div>
  );
}

function kws(langKey: string): boolean {
  return !!KEYWORDS[langKey];
}

// ---------------------------------------------------------------------------
// Text Block with collapsible long sections
// ---------------------------------------------------------------------------

function TextBlock({
  content,
  isStreaming,
  searchQuery,
}: {
  content: string;
  isStreaming: boolean;
  searchQuery: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lines = content.split('\n');
  const isLong = lines.length > 50;
  const displayContent = collapsed
    ? lines.slice(0, 5).join('\n') + '\n...'
    : content;

  return (
    <div className="group relative">
      {isLong && !isStreaming && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center gap-1 text-[10px] text-muted-foreground',
            'mb-1 transition-colors hover:text-foreground'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {collapsed ? `Show all (${lines.length} lines)` : 'Collapse'}
        </button>
      )}
      <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
        {searchQuery
          ? highlightSearchInLine(displayContent, searchQuery)
          : displayContent}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search Highlighting
// ---------------------------------------------------------------------------

function highlightSearchInLine(text: string, query: string): ReactNode[] {
  if (!query) return [text];

  const parts: ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  let key = 0;

  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, matchIndex)}</span>);
    }
    parts.push(
      <mark
        key={key++}
        className="rounded-sm bg-yellow-300/60 px-0.5 text-inherit dark:bg-yellow-500/30"
      >
        {text.slice(matchIndex, matchIndex + query.length)}
      </mark>
    );
    lastIndex = matchIndex + query.length;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [text];
}

// ---------------------------------------------------------------------------
// Output Parser
// ---------------------------------------------------------------------------

function parseOutput(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let id = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index);
      if (textContent.trim()) {
        blocks.push({ type: 'text', content: textContent, id: `t${id++}` });
      }
    }

    // Code block
    blocks.push({
      type: 'code',
      content: match[2] ?? '',
      language: match[1] || undefined,
      id: `c${id++}`,
    });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining.trim()) {
      blocks.push({ type: 'text', content: remaining, id: `t${id++}` });
    }
  }

  // If no blocks were found, treat everything as text
  if (blocks.length === 0 && text.trim()) {
    blocks.push({ type: 'text', content: text, id: 't0' });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Search Bar
// ---------------------------------------------------------------------------

function SearchBar({
  query,
  onChange,
  onClose,
  matchCount,
}: {
  query: string;
  onChange: (q: string) => void;
  onClose: () => void;
  matchCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
      <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search output..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
      {query && (
        <span className="flex-shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {matchCount} match{matchCount !== 1 ? 'es' : ''}
        </span>
      )}
      <button
        onClick={onClose}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Smart Auto-Scroll Hook
// ---------------------------------------------------------------------------

function useSmartAutoScroll(output: string, isStreaming: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const lastOutputLength = useRef(0);

  // Track user scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const threshold = 60; // px from bottom
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isUserScrolledUp.current = !atBottom;
  }, []);

  // Auto-scroll when new content arrives (only if user hasn't scrolled up)
  useEffect(() => {
    if (output.length <= lastOutputLength.current) {
      lastOutputLength.current = output.length;
      return;
    }
    lastOutputLength.current = output.length;

    if (!isUserScrolledUp.current && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }, [output]);

  // Reset scroll tracking when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      isUserScrolledUp.current = false;
    }
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    isUserScrolledUp.current = false;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  return {
    scrollRef,
    handleScroll,
    scrollToBottom,
    isScrolledUp: isUserScrolledUp,
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TaskOutput({ output, status }: TaskOutputProps) {
  const isStreaming = STREAMING_STATUSES.includes(status);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { scrollRef, handleScroll, scrollToBottom } = useSmartAutoScroll(
    output,
    isStreaming
  );
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Track scroll-up state for the button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      handleScroll();
      const threshold = 100;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setShowScrollButton(!atBottom && output.length > 0);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [handleScroll, output.length]);

  // Keyboard shortcut: Ctrl/Cmd+F to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Only intercept if this component is visible
        const el = scrollRef.current;
        if (el && el.offsetParent !== null) {
          e.preventDefault();
          setShowSearch(true);
        }
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Parse output into blocks
  const blocks = useMemo(() => parseOutput(output), [output]);

  // Count search matches
  const matchCount = useMemo(() => {
    if (!searchQuery) return 0;
    const lower = output.toLowerCase();
    const q = searchQuery.toLowerCase();
    let count = 0;
    let idx = lower.indexOf(q);
    while (idx !== -1) {
      count++;
      idx = lower.indexOf(q, idx + 1);
    }
    return count;
  }, [output, searchQuery]);

  // Empty state
  if (!output) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-muted-foreground">
        {isStreaming ? (
          <>
            <div className="relative mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-primary opacity-20" />
            </div>
            <p className="text-sm font-medium">Waiting for output...</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Claude is working on this task
            </p>
          </>
        ) : (
          <>
            <Terminal className="mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm">No output available</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border',
        'bg-muted/20 dark:bg-black/20',
        isStreaming && 'animate-stream-glow'
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b bg-card/50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <>
              <LiveBadge />
              <span className="text-[10px] text-muted-foreground">
                {output.length.toLocaleString()} chars
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Terminal className="h-3 w-3" />
              Output ({output.length.toLocaleString()} chars)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) setSearchQuery('');
            }}
            className={cn(
              'rounded-md p-1.5 text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              showSearch && 'bg-muted text-foreground'
            )}
            title="Search (Ctrl+F)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <CopyButton text={output} />
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <SearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          onClose={() => {
            setShowSearch(false);
            setSearchQuery('');
          }}
          matchCount={matchCount}
        />
      )}

      {/* Output Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="p-4 font-mono text-xs sm:text-sm">
          {blocks.map((block) =>
            block.type === 'code' ? (
              <CodeBlock
                key={block.id}
                content={block.content}
                language={block.language}
                isStreaming={isStreaming}
                searchQuery={searchQuery}
              />
            ) : (
              <TextBlock
                key={block.id}
                content={block.content}
                isStreaming={false}
                searchQuery={searchQuery}
              />
            )
          )}

          {/* Streaming cursor */}
          {isStreaming && <StreamingCursor />}
        </div>

        {/* Scroll to bottom button */}
        <ScrollToBottomButton
          onClick={scrollToBottom}
          visible={showScrollButton}
        />
      </div>

      {/* Streaming footer */}
      {isStreaming && (
        <div className="flex flex-shrink-0 items-center gap-2 border-t bg-card/50 px-3 py-1.5">
          <Radio className="h-3 w-3 animate-live-pulse text-red-500" />
          <span className="text-[10px] text-muted-foreground">
            Streaming live output from Claude...
          </span>
        </div>
      )}
    </div>
  );
}
