import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiffViewer } from '../DiffViewer';
import type { DiffResult, FileChange } from '@/lib/git/diff';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({ original, modified, language, options }: any) => (
    <div data-testid="monaco-diff-editor">
      <div data-testid="original-content">{original}</div>
      <div data-testid="modified-content">{modified}</div>
      <div data-testid="language">{language}</div>
      <div data-testid="render-side-by-side">
        {options?.renderSideBySide ? 'true' : 'false'}
      </div>
      <div data-testid="minimap-enabled">
        {options?.minimap?.enabled ? 'true' : 'false'}
      </div>
      <div data-testid="hide-unchanged">
        {options?.hideUnchangedRegions?.enabled ? 'true' : 'false'}
      </div>
    </div>
  ),
}));

// Mock child components
vi.mock('../FileTree', () => ({
  FileTree: ({ files, selectedFile, onSelectFile }: any) => (
    <div data-testid="file-tree">
      {files.map((file: FileChange) => (
        <button
          key={file.path}
          data-testid={`file-${file.path}`}
          onClick={() => onSelectFile(file)}
        >
          {file.path}
        </button>
      ))}
      {selectedFile && (
        <div data-testid="selected-file">{selectedFile.path}</div>
      )}
    </div>
  ),
}));

vi.mock('../DiffStats', () => ({
  DiffStats: ({ stats }: any) => (
    <div data-testid="diff-stats">
      {stats.filesChanged} files, +{stats.insertions}, -{stats.deletions}
    </div>
  ),
}));

// Mock useMediaQuery hook
vi.mock('@/shared/hooks', () => ({
  useMediaQuery: () => false, // Default to desktop
}));

describe('DiffViewer', () => {
  const mockDiffResult: DiffResult = {
    fullDiff: 'mock full diff',
    changedFiles: [
      {
        path: 'src/file1.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        patch: 'mock patch 1',
      },
      {
        path: 'src/file2.tsx',
        status: 'added',
        additions: 20,
        deletions: 0,
        patch: 'mock patch 2',
      },
    ],
    stats: {
      filesChanged: 2,
      insertions: 30,
      deletions: 5,
    },
  };

  const mockFileContent = {
    before: 'original content',
    after: 'modified content',
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      (global.fetch as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<DiffViewer taskId="test-task-1" />);

      expect(screen.getByText('Loading diff...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error when diff fetch fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Failed to load diff' }),
      });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Failed to load diff/)).toBeInTheDocument();
      });
    });

    it('should show error when fetch throws', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should show error when file content fetch fails', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Failed to load file content' }),
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
        expect(
          screen.getByText(/Failed to load file content/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no files changed', async () => {
      const emptyDiff: DiffResult = {
        fullDiff: '',
        changedFiles: [],
        stats: {
          filesChanged: 0,
          insertions: 0,
          deletions: 0,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyDiff,
      });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText('No changes detected')).toBeInTheDocument();
      });
    });
  });

  describe('Successful Load', () => {
    it('should load and display diff data', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('diff-stats')).toBeInTheDocument();
        expect(screen.getByTestId('file-tree')).toBeInTheDocument();
      });
    });

    it('should auto-select first file', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file1.ts'
        );
      });
    });

    it('should fetch correct API endpoints', async () => {
      const fetchMock = vi.fn();
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      global.fetch = fetchMock;

      render(<DiffViewer taskId="test-task-123" />);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/tasks/test-task-123/diff');
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/tasks/test-task-123/files/src/file1.ts'
        );
      });
    });
  });

  describe('File Selection', () => {
    it('should load file content when file is selected', async () => {
      const user = userEvent.setup();

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            before: 'content2 before',
            after: 'content2 after',
          }),
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('file-tree')).toBeInTheDocument();
      });

      const file2Button = screen.getByTestId('file-src/file2.tsx');
      await user.click(file2Button);

      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file2.tsx'
        );
      });
    });
  });

  describe('Monaco Editor Integration', () => {
    it('should render Monaco DiffEditor with correct content', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument();
        expect(screen.getByTestId('original-content')).toHaveTextContent(
          'original content'
        );
        expect(screen.getByTestId('modified-content')).toHaveTextContent(
          'modified content'
        );
      });
    });

    it('should set correct language based on file extension', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('typescript');
      });
    });

    it('should render in side-by-side mode by default', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('render-side-by-side')).toHaveTextContent(
          'true'
        );
      });
    });

    it('should have minimap disabled by default', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('minimap-enabled')).toHaveTextContent(
          'false'
        );
      });
    });

    it('should have hideUnchangedRegions enabled', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('hide-unchanged')).toHaveTextContent('true');
      });
    });
  });

  describe('File Header', () => {
    it('should display selected file path with breadcrumb style', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        // The file header now shows dir path and filename separately
        const headers = screen.getAllByText('file1.ts');
        const header = headers.find((el) => {
          const h3 = el.closest('h3');
          return h3 !== null;
        });
        expect(header).toBeInTheDocument();
      });
    });

    it('should display directory path in muted color', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        const dirSpan = screen.getByText('src/');
        expect(dirSpan).toHaveClass('text-text-muted');
      });
    });

    it('should display file status badge', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText('Modified')).toBeInTheDocument();
      });
    });

    it('should display file navigation with index', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText('1/2')).toBeInTheDocument();
      });
    });

    it('should display inline file stats', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        // The header now shows file-level +/- stats
        expect(screen.getByText('+10')).toBeInTheDocument();
        expect(screen.getByText('-5')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should show view mode toggle buttons', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTitle('Side by side')).toBeInTheDocument();
        expect(screen.getByTitle('Unified')).toBeInTheDocument();
      });
    });
  });

  describe('Toolbar Controls', () => {
    it('should show sidebar toggle button', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTitle('Hide file tree')).toBeInTheDocument();
      });
    });

    it('should show minimap toggle button', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTitle('Show minimap')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should navigate to next file with j key', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ before: 'b2', after: 'a2' }),
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file1.ts'
        );
      });

      // Wait for file content to load so the component is fully settled
      await waitFor(() => {
        expect(screen.getByTestId('modified-content')).toHaveTextContent(
          'modified content'
        );
      });

      fireEvent.keyDown(document, { key: 'j' });

      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file2.tsx'
        );
      });
    });

    it('should navigate to previous file with k key', async () => {
      const user = userEvent.setup();

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ before: 'b2', after: 'a2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file1.ts'
        );
      });

      // Navigate to second file
      const file2Button = screen.getByTestId('file-src/file2.tsx');
      await user.click(file2Button);

      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file2.tsx'
        );
      });

      // Press k to go back
      fireEvent.keyDown(document, { key: 'k' });

      await waitFor(() => {
        expect(screen.getByTestId('selected-file')).toHaveTextContent(
          'src/file1.ts'
        );
      });
    });

    it('should show keyboard hint in sidebar', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByText('navigate')).toBeInTheDocument();
      });
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript for .ts files', async () => {
      const tsFile: DiffResult = {
        ...mockDiffResult,
        changedFiles: [
          {
            path: 'test.ts',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: 'mock',
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => tsFile,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('typescript');
      });
    });

    it('should detect JavaScript for .js files', async () => {
      const jsFile: DiffResult = {
        ...mockDiffResult,
        changedFiles: [
          {
            path: 'test.js',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: 'mock',
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => jsFile,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('javascript');
      });
    });

    it('should detect Python for .py files', async () => {
      const pyFile: DiffResult = {
        ...mockDiffResult,
        changedFiles: [
          {
            path: 'test.py',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: 'mock',
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pyFile,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('python');
      });
    });

    it('should default to plaintext for unknown extensions', async () => {
      const unknownFile: DiffResult = {
        ...mockDiffResult,
        changedFiles: [
          {
            path: 'test.xyz',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: 'mock',
          },
        ],
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => unknownFile,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('plaintext');
      });
    });
  });

  describe('Component Integration', () => {
    it('should pass stats to DiffStats component', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        const diffStats = screen.getByTestId('diff-stats');
        expect(diffStats).toHaveTextContent('2 files');
        expect(diffStats).toHaveTextContent('+30');
        expect(diffStats).toHaveTextContent('-5');
      });
    });

    it('should pass files to FileTree component', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('file-src/file1.ts')).toBeInTheDocument();
        expect(screen.getByTestId('file-src/file2.tsx')).toBeInTheDocument();
      });
    });
  });

  describe('Comment Anchor', () => {
    it('should render hidden comment anchor for selected file', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDiffResult,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFileContent,
        });

      const { container } = render(<DiffViewer taskId="test-task-1" />);

      await waitFor(() => {
        const anchor = container.querySelector(
          '[data-comment-anchor="src/file1.ts"]'
        );
        expect(anchor).toBeInTheDocument();
      });
    });
  });
});
