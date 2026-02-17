# Keyboard Shortcuts

This document describes all keyboard shortcuts available in the Autobot dashboard.

## General

| Shortcut    | Description                        |
| ----------- | ---------------------------------- |
| `Shift + ?` | Show keyboard shortcuts cheatsheet |
| `Escape`    | Close modals, panels, and dialogs  |

## Navigation

| Shortcut      | Description                           |
| ------------- | ------------------------------------- |
| `Ctrl/⌘ + 1`  | Go to Tasks tab                       |
| `Ctrl/⌘ + 2`  | Go to Plans tab                       |
| `Ctrl/⌘ + 3`  | Go to QA Gates tab                    |
| `Ctrl/⌘ + 4`  | Go to Summary tab                     |
| `Ctrl/⌘ + K`  | Focus search (in Repository Selector) |
| `Tab`         | Navigate between interactive elements |
| `Shift + Tab` | Navigate backwards between elements   |

## Lists & Navigation

| Shortcut  | Description                  |
| --------- | ---------------------------- |
| `↑` / `↓` | Navigate up/down in lists    |
| `Enter`   | Select/activate focused item |
| `Home`    | Jump to first item in list   |
| `End`     | Jump to last item in list    |

## Repository Selector

| Shortcut       | Description                       |
| -------------- | --------------------------------- |
| `Ctrl/⌘ + 1-9` | Quick switch to repository 1-9    |
| `Ctrl/⌘ + K`   | Focus repository search           |
| `↑` / `↓`      | Navigate repository list          |
| `Enter`        | Select repository                 |
| `Escape`       | Clear search or blur search input |

## Focus Management

- All modals and dialogs automatically trap focus, ensuring keyboard navigation stays within the active component
- Pressing `Escape` in a modal will close it and restore focus to the previously focused element
- All interactive elements have visible focus indicators when navigating with the keyboard

## Accessibility Features

1. **Visible Focus Indicators**: All focusable elements show a clear blue ring when focused
2. **Focus Trap**: Modals and dialogs trap focus to prevent keyboard users from accidentally leaving
3. **ARIA Labels**: All interactive elements have appropriate ARIA labels for screen readers
4. **Keyboard-Only Navigation**: Every action in the app can be performed with just the keyboard
5. **Reduced Motion**: Respects `prefers-reduced-motion` for users with motion sensitivity

## Implementation Details

For developers:

- **useKeyboardShortcuts**: Central hook for managing global keyboard shortcuts
- **useArrowKeyNavigation**: Hook for implementing arrow key navigation in lists
- **useFocusTrap**: Hook for trapping focus within a container (modals, dialogs)
- **TooltipWithShortcut**: Component for showing tooltips with keyboard shortcuts
- **KeyboardShortcutsModal**: Modal that displays all available shortcuts

All keyboard shortcuts respect user preferences and exclude input fields by default.
