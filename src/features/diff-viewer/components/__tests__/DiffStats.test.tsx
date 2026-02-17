import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffStats } from '../DiffStats';
import type { DiffStats as DiffStatsType } from '@/lib/git/diff';

describe('DiffStats', () => {
  describe('Rendering', () => {
    it('should render stats with singular "file" label', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('file')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render stats with plural "files" label', () => {
      const stats: DiffStatsType = {
        filesChanged: 3,
        insertions: 42,
        deletions: 15,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('files')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should render zero stats', () => {
      const stats: DiffStatsType = {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      };

      render(<DiffStats stats={stats} />);

      // filesChanged=0 renders "files" (plural)
      expect(screen.getByText('files')).toBeInTheDocument();
      // All three spans contain "0" – file count, insertions, deletions
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Styling', () => {
    it('should apply correct CSS classes for insertions', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      render(<DiffStats stats={stats} />);

      const insertionSpan = screen.getByText('10').closest('span');
      expect(insertionSpan).toHaveClass('text-emerald-500');
      expect(insertionSpan).toHaveClass('font-mono');
    });

    it('should apply correct CSS classes for deletions', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      render(<DiffStats stats={stats} />);

      const deletionSpan = screen.getByText('5').closest('span');
      expect(deletionSpan).toHaveClass('text-red-400');
      expect(deletionSpan).toHaveClass('font-mono');
    });

    it('should have proper container styling', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      const { container } = render(<DiffStats stats={stats} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('px-3');
      expect(wrapper).toHaveClass('py-2');
      expect(wrapper).toHaveClass('text-xs');
      expect(wrapper).toHaveClass('flex');
    });
  });

  describe('Large Numbers', () => {
    it('should handle large numbers correctly', () => {
      const stats: DiffStatsType = {
        filesChanged: 999,
        insertions: 10000,
        deletions: 5000,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('999')).toBeInTheDocument();
      expect(screen.getByText('files')).toBeInTheDocument();
      expect(screen.getByText('10000')).toBeInTheDocument();
      expect(screen.getByText('5000')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle only additions', () => {
      const stats: DiffStatsType = {
        filesChanged: 2,
        insertions: 100,
        deletions: 0,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle only deletions', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 0,
        deletions: 50,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should handle equal insertions and deletions', () => {
      const stats: DiffStatsType = {
        filesChanged: 3,
        insertions: 25,
        deletions: 25,
      };

      render(<DiffStats stats={stats} />);

      // Both insertions and deletions are 25, so two elements with "25"
      const twentyFives = screen.getAllByText('25');
      expect(twentyFives.length).toBe(2);
    });
  });

  describe('Accessibility', () => {
    it('should use a flat div structure (no heading)', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      const { container } = render(<DiffStats stats={stats} />);

      // The component is a flat div with spans - no heading
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.tagName).toBe('DIV');
      expect(container.querySelector('h3')).toBeNull();
    });

    it('should have readable text for screen readers', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('1')).toBeVisible();
      expect(screen.getByText('file')).toBeVisible();
      expect(screen.getByText('10')).toBeVisible();
      expect(screen.getByText('5')).toBeVisible();
    });
  });

  describe('Change Bar', () => {
    it('should render the mini change bar when total > 0', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      const { container } = render(<DiffStats stats={stats} />);

      const bar = container.querySelector('.bg-emerald-500.rounded-l-full');
      expect(bar).toBeInTheDocument();
    });

    it('should not render the mini change bar when total is 0', () => {
      const stats: DiffStatsType = {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      };

      const { container } = render(<DiffStats stats={stats} />);

      const bar = container.querySelector('.bg-emerald-500.rounded-l-full');
      expect(bar).toBeNull();
    });
  });
});
