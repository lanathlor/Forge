import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  describe('Rendering', () => {
    it('should render file tree with all files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('Changed Files (4)')).toBeInTheDocument();
      expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument();
      expect(screen.getByText('src/utils/helpers.ts')).toBeInTheDocument();
      expect(screen.getByText('src/old-file.ts')).toBeInTheDocument();
      expect(screen.getByText('src/renamed-file.ts')).toBeInTheDocument();
    });

    it('should display correct file count', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('Changed Files (4)')).toBeInTheDocument();
    });

    it('should render empty state with zero files', () => {
      render(
        <FileTree
          files={[]}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('Changed Files (0)')).toBeInTheDocument();
    });
  });

  describe('File Status Icons', () => {
    it('should show correct icon for added files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const addedFileButton = screen
        .getByText('src/utils/helpers.ts')
        .closest('button');
      expect(addedFileButton?.textContent).toContain('✨');
    });

    it('should show correct icon for modified files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const modifiedFileButton = screen
        .getByText('src/components/Button.tsx')
        .closest('button');
      expect(modifiedFileButton?.textContent).toContain('✏️');
    });

    it('should show correct icon for deleted files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const deletedFileButton = screen
        .getByText('src/old-file.ts')
        .closest('button');
      expect(deletedFileButton?.textContent).toContain('🗑️');
    });

    it('should show correct icon for renamed files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const renamedFileButton = screen
        .getByText('src/renamed-file.ts')
        .closest('button');
      expect(renamedFileButton?.textContent).toContain('📝');
    });
  });

  describe('File Stats Display', () => {
    it('should display additions and deletions', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('+10')).toBeInTheDocument();
      expect(screen.getByText('-5')).toBeInTheDocument();
    });

    it('should show zero deletions for added files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const addedFileButton = screen
        .getByText('src/utils/helpers.ts')
        .closest('button');
      expect(addedFileButton?.textContent).toContain('+20');
      expect(addedFileButton?.textContent).toContain('-0');
    });

    it('should show zero additions for deleted files', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const deletedFileButton = screen
        .getByText('src/old-file.ts')
        .closest('button');
      expect(deletedFileButton?.textContent).toContain('+0');
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

      const fileButton = screen.getByText('src/components/Button.tsx');
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
        .getByText('src/components/Button.tsx')
        .closest('button');
      expect(selectedButton).toHaveClass('bg-blue-100');
      expect(selectedButton).toHaveClass('text-blue-900');
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
        .getByText('src/utils/helpers.ts')
        .closest('button');
      expect(nonSelectedButton).not.toHaveClass('bg-blue-100');
      expect(nonSelectedButton).toHaveClass('hover:bg-gray-100');
    });
  });

  describe('Legend', () => {
    it('should display status legend', () => {
      render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(screen.getByText('New file')).toBeInTheDocument();
      expect(screen.getByText('Modified')).toBeInTheDocument();
      expect(screen.getByText('Deleted')).toBeInTheDocument();
      expect(screen.getByText('Renamed')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have proper sidebar styling', () => {
      const { container } = render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('w-80');
      expect(aside).toHaveClass('border-r');
      expect(aside).toHaveClass('border-gray-200');
      expect(aside).toHaveClass('bg-gray-50');
      expect(aside).toHaveClass('overflow-y-auto');
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
        .getByText('src/components/Button.tsx')
        .closest('button');
      expect(fileButton).toHaveClass('w-full');
      expect(fileButton).toHaveClass('text-left');
      expect(fileButton).toHaveClass('px-3');
      expect(fileButton).toHaveClass('py-2');
      expect(fileButton).toHaveClass('rounded');
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

      expect(screen.getByText('Changed Files (1)')).toBeInTheDocument();
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

      expect(screen.getByText('Changed Files (50)')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper semantic HTML', () => {
      const { container } = render(
        <FileTree
          files={mockFiles}
          selectedFile={null}
          onSelectFile={mockOnSelectFile}
        />
      );

      expect(container.querySelector('aside')).toBeInTheDocument();
      expect(container.querySelector('ul')).toBeInTheDocument();
      const heading = screen.getByText('Changed Files (4)');
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
      expect(buttons.length).toBe(mockFiles.length);
    });
  });

  describe('Long File Paths', () => {
    it('should handle long file paths with truncation', () => {
      const longPath =
        'src/very/deeply/nested/path/with/many/directories/and/a/very/long/filename.tsx';
      const files: FileChange[] = [
        {
          path: longPath,
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

      const pathElement = screen.getByText(longPath);
      expect(pathElement).toHaveClass('truncate');
    });
  });
});
