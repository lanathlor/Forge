import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTree } from '../FileTree';
import type { FileChange } from '@/lib/git/diff';

describe('FileTree', () => {
  const mockFiles: FileChange[] = [
    {
      path: 'src/components/Button.tsx',
      status: 'modified',
      additions: 10,
      deletions: 5,
      patch: 'mock patch',
    },
    {
      path: 'src/utils/helpers.ts',
      status: 'added',
      additions: 20,
      deletions: 0,
      patch: 'mock patch',
    },
    {
      path: 'src/old-file.ts',
      status: 'deleted',
      additions: 0,
      deletions: 15,
      patch: 'mock patch',
    },
    {
      path: 'src/renamed-file.ts',
      status: 'renamed',
      additions: 2,
      deletions: 1,
      oldPath: 'src/old-name.ts',
      patch: 'mock patch',
    },
  ];

  const mockOnSelectFile = vi.fn();

  beforeEach(() => {
    mockOnSelectFile.mockClear();
  });

  describe('Rendering', () => {
    it('should render file tree with header and file count', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('4 changed')).toBeInTheDocument();
    });

    it('should render all files in the tree structure', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // Files are shown by their basename in the tree
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
      expect(screen.getByText('helpers.ts')).toBeInTheDocument();
      expect(screen.getByText('old-file.ts')).toBeInTheDocument();
      expect(screen.getByText('renamed-file.ts')).toBeInTheDocument();
    });

    it('should display correct file count', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('4 changed')).toBeInTheDocument();
    });

    it('should render empty state with zero files', () => {
      render(
        <FileTree
          files={[]}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('0 changed')).toBeInTheDocument();
    });

    it('should render directory nodes in the tree', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // Directories are shown as folder nodes
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('components')).toBeInTheDocument();
      expect(screen.getByText('utils')).toBeInTheDocument();
    });
  });

  describe('File Status Icons', () => {
    it('should render SVG icons for file statuses (not emojis)', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // The component uses Lucide SVG icons, not emoji characters.
      // Each file button should contain an SVG element for the status icon.
      const fileButton = screen.getByText('Button.tsx').closest('button');
      expect(fileButton?.querySelector('svg')).toBeTruthy();

      const addedButton = screen.getByText('helpers.ts').closest('button');
      expect(addedButton?.querySelector('svg')).toBeTruthy();

      const deletedButton = screen.getByText('old-file.ts').closest('button');
      expect(deletedButton?.querySelector('svg')).toBeTruthy();

      const renamedButton = screen.getByText('renamed-file.ts').closest('button');
      expect(renamedButton?.querySelector('svg')).toBeTruthy();
    });
  });

  describe('File Stats Display', () => {
    it('should display additions and deletions for files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // Button.tsx has +10 / -5
      const buttonFile = screen.getByText('Button.tsx').closest('button');
      expect(buttonFile?.textContent).toContain('+10');
      expect(buttonFile?.textContent).toContain('-5');
    });

    it('should not show zero deletions for added files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // helpers.ts: added file with +20, 0 deletions
      // The component only renders stats > 0, so -0 should NOT appear
      const addedFileButton = screen.getByText('helpers.ts').closest('button');
      expect(addedFileButton?.textContent).toContain('+20');
      // -0 is not rendered because deletions === 0
      expect(addedFileButton?.textContent).not.toContain('-0');
    });

    it('should not show zero additions for deleted files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // old-file.ts: deleted file with 0 additions, -15
      const deletedFileButton = screen.getByText('old-file.ts').closest('button');
      // +0 is not rendered because additions === 0
      expect(deletedFileButton?.textContent).not.toContain('+0');
      expect(deletedFileButton?.textContent).toContain('-15');
    });
  });

  describe('Selection Interaction', () => {
    it('should call onSelectFile when clicking a file', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const fileButton = screen.getByText('Button.tsx');
      fireEvent.click(fileButton);

      expect(mockOnSelectFile).toHaveBeenCalledWith(mockFiles[0]);
    });

    it('should highlight selected file', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={mockFiles[0] || null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const selectedButton = screen
        .getByText('Button.tsx')
        .closest('button');
      // The new component uses bg-accent-primary/15 for selected state
      expect(selectedButton?.className).toContain('bg-accent-primary');
    });

    it('should not highlight non-selected files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={mockFiles[0] || null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const nonSelectedButton = screen
        .getByText('helpers.ts')
        .closest('button');
      expect(nonSelectedButton?.className).not.toContain('bg-accent-primary');
    });
  });

  describe('Tree Structure', () => {
    it('should group files by directory', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // Directories are rendered as folder nodes with toggle buttons
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.getByText('components')).toBeInTheDocument();
      expect(screen.getByText('utils')).toBeInTheDocument();
    });

    it('should show aggregated stats on folder nodes', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // The src folder button should show aggregated stats
      const srcButton = screen.getByText('src').closest('button');
      expect(srcButton?.textContent).toContain('+32');
      expect(srcButton?.textContent).toContain('-21');
    });

    it('should be able to collapse and expand directories', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // Initially the src folder is expanded (totalFiles <= 8)
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();

      // Click the components folder to collapse it
      const componentsFolder = screen.getByText('components').closest('button');
      fireEvent.click(componentsFolder!);

      // Button.tsx should be hidden now
      expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();

      // Click again to expand
      fireEvent.click(componentsFolder!);
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should use div-based layout (not aside)', () => {
      const { container } = render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // The component uses div, not aside
      expect(container.querySelector('aside')).toBeNull();
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.tagName).toBe('DIV');
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
    });

    it('should style file buttons correctly', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const fileButton = screen
        .getByText('Button.tsx')
        .closest('button');
      expect(fileButton).toHaveClass('w-full');
      expect(fileButton).toHaveClass('text-xs');
      expect(fileButton).toHaveClass('rounded-md');
    });
  });

  describe('Multiple Files', () => {
    it('should handle single file', () => {
      const singleFile: FileChange[] = [
        {
          path: 'test.ts',
          status: 'modified',
          additions: 5,
          deletions: 2,
          patch: 'mock patch',
        },
      ];

      render(
        <FileTree
          files={singleFile}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('1 changed')).toBeInTheDocument();
      expect(screen.getByText('test.ts')).toBeInTheDocument();
    });

    it('should handle many files', () => {
      const manyFiles: FileChange[] = Array.from({ length: 50 }, (_, i) => ({
        path: `file-${i}.ts`,
        status: 'modified' as const,
        additions: i,
        deletions: i * 2,
        patch: 'mock patch',
      }));

      render(
        <FileTree
          files={manyFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('50 changed')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const heading = screen.getByText('Files');
      expect(heading.tagName).toBe('H3');
    });

    it('should have clickable buttons for each file', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const buttons = screen.getAllByRole('button');
      // Includes both folder toggle buttons and file buttons
      // src folder + components folder + utils folder = 3 dir buttons
      // Button.tsx + helpers.ts + old-file.ts + renamed-file.ts = 4 file buttons
      // Total = 7 buttons
      expect(buttons.length).toBe(7);
    });

    it('should have file path in title attribute for full path access', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const fileButton = screen.getByText('Button.tsx').closest('button');
      expect(fileButton).toHaveAttribute('title', 'src/components/Button.tsx');
    });
  });

  describe('Path Collapsing', () => {
    it('should collapse single-child directories into combined paths', () => {
      const files: FileChange[] = [
        {
          path: 'src/very/deeply/nested/file.tsx',
          status: 'modified',
          additions: 5,
          deletions: 2,
          patch: 'mock patch',
        },
      ];

      render(
        <FileTree
          files={files}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // Single-child directories get collapsed:
      // src/very/deeply/nested is collapsed into one folder node
      expect(screen.getByText('src/very/deeply/nested')).toBeInTheDocument();
      expect(screen.getByText('file.tsx')).toBeInTheDocument();
    });

    it('should handle truncation via CSS class', () => {
      const files: FileChange[] = [
        {
          path: 'src/components/very-long-filename-that-might-overflow.tsx',
          status: 'modified',
          additions: 5,
          deletions: 2,
          patch: 'mock patch',
        },
      ];

      render(
        <FileTree
          files={files}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const fileNameSpan = screen.getByText('very-long-filename-that-might-overflow.tsx');
      expect(fileNameSpan).toHaveClass('truncate');
    });
  });

  describe('Search Filter', () => {
    it('should not show filter for 5 or fewer files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      // 4 files should not show filter
      expect(screen.queryByPlaceholderText('Filter files...')).not.toBeInTheDocument();
    });

    it('should show filter for more than 5 files', () => {
      const manyFiles: FileChange[] = Array.from({ length: 6 }, (_, i) => ({
        path: `src/file-${i}.ts`,
        status: 'modified' as const,
        additions: i,
        deletions: i,
        patch: 'mock patch',
      }));

      render(
        <FileTree
          files={manyFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByPlaceholderText('Filter files...')).toBeInTheDocument();
    });

    it('should filter files by path when typing in search', async () => {
      const user = userEvent.setup();
      const manyFiles: FileChange[] = [
        { path: 'src/components/Button.tsx', status: 'modified', additions: 5, deletions: 2, patch: '' },
        { path: 'src/utils/helpers.ts', status: 'added', additions: 10, deletions: 0, patch: '' },
        { path: 'src/hooks/useAuth.ts', status: 'modified', additions: 3, deletions: 1, patch: '' },
        { path: 'src/hooks/useTheme.ts', status: 'modified', additions: 7, deletions: 4, patch: '' },
        { path: 'src/types/index.ts', status: 'modified', additions: 2, deletions: 1, patch: '' },
        { path: 'README.md', status: 'modified', additions: 1, deletions: 0, patch: '' },
      ];

      render(
        <FileTree
          files={manyFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const filterInput = screen.getByPlaceholderText('Filter files...');
      await user.type(filterInput, 'hook');

      // Should show only hook-related files in flat view
      expect(screen.getByText('useAuth.ts')).toBeInTheDocument();
      expect(screen.getByText('useTheme.ts')).toBeInTheDocument();
      // Should not show non-matching files
      expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();
      expect(screen.queryByText('helpers.ts')).not.toBeInTheDocument();
    });

    it('should show no results message when filter matches nothing', async () => {
      const user = userEvent.setup();
      const manyFiles: FileChange[] = Array.from({ length: 6 }, (_, i) => ({
        path: `src/file-${i}.ts`,
        status: 'modified' as const,
        additions: i,
        deletions: i,
        patch: 'mock patch',
      }));

      render(
        <FileTree
          files={manyFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const filterInput = screen.getByPlaceholderText('Filter files...');
      await user.type(filterInput, 'nonexistent');

      expect(screen.getByText(/No files match/)).toBeInTheDocument();
    });

    it('should show clear button when filter has text', async () => {
      const user = userEvent.setup();
      const manyFiles: FileChange[] = Array.from({ length: 6 }, (_, i) => ({
        path: `src/file-${i}.ts`,
        status: 'modified' as const,
        additions: i,
        deletions: i,
        patch: 'mock patch',
      }));

      render(
        <FileTree
          files={manyFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const filterInput = screen.getByPlaceholderText('Filter files...');
      await user.type(filterInput, 'test');

      // Clear button should be visible (it's the X icon button)
      const clearButtons = screen.getAllByRole('button');
      const clearButton = clearButtons.find((btn) => btn.querySelector('svg'));
      expect(clearButton).toBeTruthy();
    });

    it('should show directory path in flat filtered results', async () => {
      const user = userEvent.setup();
      const manyFiles: FileChange[] = [
        { path: 'src/components/Button.tsx', status: 'modified', additions: 5, deletions: 2, patch: '' },
        { path: 'src/utils/helpers.ts', status: 'added', additions: 10, deletions: 0, patch: '' },
        { path: 'src/hooks/useAuth.ts', status: 'modified', additions: 3, deletions: 1, patch: '' },
        { path: 'src/hooks/useTheme.ts', status: 'modified', additions: 7, deletions: 4, patch: '' },
        { path: 'src/types/index.ts', status: 'modified', additions: 2, deletions: 1, patch: '' },
        { path: 'README.md', status: 'modified', additions: 1, deletions: 0, patch: '' },
      ];

      render(
        <FileTree
          files={manyFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const filterInput = screen.getByPlaceholderText('Filter files...');
      await user.type(filterInput, 'Button');

      // Should show directory path in flat view
      expect(screen.getByText('src/components')).toBeInTheDocument();
      expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    });
  });
});
