import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportExportConfig } from '../ImportExportConfig';
import type { QAGate } from '../../types/qa-gates';

vi.mock('lucide-react', () => ({
  Download: (props: Record<string, unknown>) => <svg data-testid="download-icon" {...props} />,
  Upload: (props: Record<string, unknown>) => <svg data-testid="upload-icon" {...props} />,
}));

describe('ImportExportConfig', () => {
  const mockGates: QAGate[] = [
    { name: 'ESLint', command: 'pnpm lint', timeout: 60000, enabled: true, failOnError: true, order: 1 },
    { name: 'Tests', command: 'pnpm test', timeout: 300000, enabled: true, failOnError: false, order: 2 },
  ];

  const defaultProps = {
    gates: mockGates,
    version: '1.0',
    maxRetries: 3,
    onImport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export and import buttons', () => {
    render(<ImportExportConfig {...defaultProps} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
  });

  it('creates download when export button is clicked', async () => {
    const user = userEvent.setup();

    const mockCreateObjectURL = vi.fn(() => 'blob:test');
    const mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;

    render(<ImportExportConfig {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /export/i }));

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('imports gates from file with qaGates property', async () => {
    const user = userEvent.setup();
    render(<ImportExportConfig {...defaultProps} />);

    const fileContent = JSON.stringify({
      qaGates: [
        { name: 'Build', command: 'pnpm build', timeout: 120000, enabled: true, failOnError: true, order: 1 },
      ],
    });

    const file = new File([fileContent], 'config.json', { type: 'application/json' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(defaultProps.onImport).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Build', command: 'pnpm build' }),
    ]);
  });

  it('imports gates from file with array format', async () => {
    const user = userEvent.setup();
    render(<ImportExportConfig {...defaultProps} />);

    const fileContent = JSON.stringify([
      { name: 'Lint', command: 'lint', timeout: 60000, enabled: true, failOnError: true, order: 1 },
    ]);

    const file = new File([fileContent], 'config.json', { type: 'application/json' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(defaultProps.onImport).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Lint' }),
    ]);
  });

  it('handles invalid JSON gracefully', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ImportExportConfig {...defaultProps} />);

    const file = new File(['not json'], 'config.json', { type: 'application/json' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse config file');
    expect(defaultProps.onImport).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
