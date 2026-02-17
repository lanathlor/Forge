import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanPreflightBanner } from '../PlanPreflightBanner';
import { usePreflightChecks } from '../../hooks/usePreflightChecks';

vi.mock('../../hooks/usePreflightChecks', () => ({
  usePreflightChecks: vi.fn(),
}));

const mockUsePreflightChecks = vi.mocked(usePreflightChecks);

describe('PlanPreflightBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when disabled', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [],
      isReady: false,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    const { container } = render(
      <PlanPreflightBanner
        repositoryId="repo-1"
        planId="plan-1"
        enabled={false}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should return null when no checks', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [],
      isReady: false,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    const { container } = render(
      <PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should show "All systems go" when all checks pass', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'pass',
          detail: 'my-repo',
        },
        {
          id: 'clean',
          label: 'Working tree clean',
          status: 'pass',
          detail: 'Clean',
        },
      ],
      isReady: true,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    render(<PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />);
    expect(screen.getByText('All systems go')).toBeInTheDocument();
    expect(screen.getByText('Repository accessible')).toBeInTheDocument();
    expect(screen.getByText('Working tree clean')).toBeInTheDocument();
  });

  it('should show "Pre-flight check failed" when a check fails', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'fail',
          detail: 'Not found',
        },
        {
          id: 'clean',
          label: 'Working tree clean',
          status: 'pass',
          detail: 'Clean',
        },
      ],
      isReady: false,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    render(<PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />);
    expect(screen.getByText('Pre-flight check failed')).toBeInTheDocument();
  });

  it('should show "Ready with warnings" when checks have warnings but no failures', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'pass',
          detail: 'my-repo',
        },
        {
          id: 'clean',
          label: 'Working tree clean',
          status: 'warn',
          detail: 'Uncommitted changes',
        },
      ],
      isReady: true,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    render(<PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />);
    expect(screen.getByText('Ready with warnings')).toBeInTheDocument();
  });

  it('should show "Running pre-flight checks..." when checking', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'checking',
          detail: '',
        },
      ],
      isReady: false,
      isChecking: true,
      rerunChecks: vi.fn(),
    });

    render(<PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />);
    expect(
      screen.getByText('Running pre-flight checks...')
    ).toBeInTheDocument();
  });

  it('should show detail text for non-pass checks', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'fail',
          detail: 'Not found',
        },
      ],
      isReady: false,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    render(<PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />);
    expect(screen.getByText('(Not found)')).toBeInTheDocument();
  });

  it('should not show detail text for passing checks', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'pass',
          detail: 'my-repo',
        },
      ],
      isReady: true,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    render(<PlanPreflightBanner repositoryId="repo-1" planId="plan-1" />);
    expect(screen.queryByText('(my-repo)')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    mockUsePreflightChecks.mockReturnValue({
      checks: [
        {
          id: 'repo',
          label: 'Repository accessible',
          status: 'pass',
          detail: 'my-repo',
        },
      ],
      isReady: true,
      isChecking: false,
      rerunChecks: vi.fn(),
    });

    const { container } = render(
      <PlanPreflightBanner
        repositoryId="repo-1"
        planId="plan-1"
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
