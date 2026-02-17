'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import {
  formatShortcut,
  type KeyboardShortcut,
} from '@/shared/hooks/useKeyboardShortcuts';
import {
  Keyboard,
  Search,
  Navigation,
  Command as CommandIcon,
  Layout,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: KeyboardShortcut[];
}

const BUILT_IN_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: 'help',
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts',
    category: 'General',
    handler: () => {},
  },
  {
    id: 'search',
    key: 'k',
    ctrl: true,
    description: 'Focus search',
    category: 'Navigation',
    handler: () => {},
  },
  {
    id: 'escape',
    key: 'Escape',
    description: 'Close modals / Clear search',
    category: 'General',
    handler: () => {},
  },
  {
    id: 'tab',
    key: 'Tab',
    description: 'Navigate between elements',
    category: 'Navigation',
    handler: () => {},
  },
  {
    id: 'arrow-up',
    key: 'ArrowUp',
    description: 'Move up in lists',
    category: 'Navigation',
    handler: () => {},
  },
  {
    id: 'arrow-down',
    key: 'ArrowDown',
    description: 'Move down in lists',
    category: 'Navigation',
    handler: () => {},
  },
  {
    id: 'enter',
    key: 'Enter',
    description: 'Select / Confirm',
    category: 'General',
    handler: () => {},
  },
];

const CATEGORY_ICONS: Record<string, typeof Keyboard> = {
  General: Keyboard,
  Navigation: Navigation,
  Search: Search,
  Actions: CommandIcon,
  View: Layout,
};

function ShortcutKey({ shortcut }: { shortcut: string }) {
  return (
    <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 font-mono text-xs shadow-sm">
      {shortcut}
    </kbd>
  );
}

function ShortcutRow({ shortcut }: { shortcut: KeyboardShortcut }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50">
      <span className="text-sm">{shortcut.description}</span>
      <ShortcutKey shortcut={formatShortcut(shortcut)} />
    </div>
  );
}

function ShortcutCategory({
  category,
  shortcuts,
}: {
  category: string;
  shortcuts: KeyboardShortcut[];
}) {
  const Icon = CATEGORY_ICONS[category] || Keyboard;

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{category}</h3>
        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
          {shortcuts.length}
        </Badge>
      </div>
      <div className="space-y-0.5">
        {shortcuts.map((shortcut) => (
          <ShortcutRow key={shortcut.id} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
  shortcuts = [],
}: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  // Combine built-in and custom shortcuts
  const allShortcuts = useMemo(() => {
    return [...BUILT_IN_SHORTCUTS, ...(shortcuts || [])];
  }, [shortcuts]);

  // Group by category and filter by search
  const groupedShortcuts = useMemo(() => {
    const filtered = allShortcuts.filter((shortcut) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.key.toLowerCase().includes(query) ||
        shortcut.category?.toLowerCase().includes(query)
      );
    });

    const groups: Record<string, KeyboardShortcut[]> = {};
    filtered.forEach((shortcut) => {
      const category = shortcut.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(shortcut);
    });

    return groups;
  }, [allShortcuts, searchQuery]);

  const categoryOrder = [
    'General',
    'Navigation',
    'Search',
    'Actions',
    'View',
    'Other',
  ];
  const sortedCategories = Object.keys(groupedShortcuts).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Navigate faster with keyboard shortcuts. Press{' '}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
              ?
            </kbd>{' '}
            anytime to view this guide.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            className={cn(
              'h-9 w-full rounded-md border pl-9 pr-3 text-sm',
              'border-border/50 bg-muted/30',
              'placeholder:text-muted-foreground/50',
              'focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40',
              'transition-all duration-150'
            )}
            autoFocus
          />
        </div>

        {/* Shortcuts list */}
        <div className="-mx-1 flex-1 space-y-6 overflow-y-auto px-1">
          {sortedCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No shortcuts found for &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : (
            sortedCategories.map((category) => {
              const categoryShortcuts = groupedShortcuts[category];
              if (!categoryShortcuts) return null;
              return (
                <ShortcutCategory
                  key={category}
                  category={category}
                  shortcuts={categoryShortcuts}
                />
              );
            })
          )}
        </div>

        {/* Footer tip */}
        <div className="border-t border-border/50 pt-3">
          <p className="text-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="h-3 w-3" />
              Tip: Most shortcuts work globally, even when not in focus
            </span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
