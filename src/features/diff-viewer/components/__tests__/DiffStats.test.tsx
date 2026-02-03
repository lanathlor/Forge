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

      expect(screen.getByText('Changes Summary')).toBeInTheDocument();
      expect(screen.getByText('1 file changed')).toBeInTheDocument();
      expect(screen.getByText('+10 insertions')).toBeInTheDocument();
      expect(screen.getByText('-5 deletions')).toBeInTheDocument();
    });

    it('should render stats with plural "files" label', () => {
      const stats: DiffStatsType = {
        filesChanged: 3,
        insertions: 42,
        deletions: 15,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('3 files changed')).toBeInTheDocument();
      expect(screen.getByText('+42 insertions')).toBeInTheDocument();
      expect(screen.getByText('-15 deletions')).toBeInTheDocument();
    });

    it('should render zero stats', () => {
      const stats: DiffStatsType = {
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('0 files changed')).toBeInTheDocument();
      expect(screen.getByText('+0 insertions')).toBeInTheDocument();
      expect(screen.getByText('-0 deletions')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply correct CSS classes for insertions', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      const { container } = render(<DiffStats stats={stats} />);

      const insertionText = screen.getByText('+10 insertions');
      expect(insertionText).toHaveClass('text-green-600');
      expect(insertionText).toHaveClass('font-medium');
    });

    it('should apply correct CSS classes for deletions', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      render(<DiffStats stats={stats} />);

      const deletionText = screen.getByText('-5 deletions');
      expect(deletionText).toHaveClass('text-red-600');
      expect(deletionText).toHaveClass('font-medium');
    });

    it('should have proper container styling', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      const { container } = render(<DiffStats stats={stats} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('px-4');
      expect(wrapper).toHaveClass('py-3');
      expect(wrapper).toHaveClass('bg-gray-100');
      expect(wrapper).toHaveClass('border-b');
      expect(wrapper).toHaveClass('border-gray-200');
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

      expect(screen.getByText('999 files changed')).toBeInTheDocument();
      expect(screen.getByText('+10000 insertions')).toBeInTheDocument();
      expect(screen.getByText('-5000 deletions')).toBeInTheDocument();
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

      expect(screen.getByText('+100 insertions')).toBeInTheDocument();
      expect(screen.getByText('-0 deletions')).toBeInTheDocument();
    });

    it('should handle only deletions', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 0,
        deletions: 50,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('+0 insertions')).toBeInTheDocument();
      expect(screen.getByText('-50 deletions')).toBeInTheDocument();
    });

    it('should handle equal insertions and deletions', () => {
      const stats: DiffStatsType = {
        filesChanged: 3,
        insertions: 25,
        deletions: 25,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('+25 insertions')).toBeInTheDocument();
      expect(screen.getByText('-25 deletions')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic HTML structure', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      const { container } = render(<DiffStats stats={stats} />);

      const heading = screen.getByText('Changes Summary');
      expect(heading.tagName).toBe('H3');
    });

    it('should have readable text for screen readers', () => {
      const stats: DiffStatsType = {
        filesChanged: 1,
        insertions: 10,
        deletions: 5,
      };

      render(<DiffStats stats={stats} />);

      expect(screen.getByText('1 file changed')).toBeVisible();
      expect(screen.getByText('+10 insertions')).toBeVisible();
      expect(screen.getByText('-5 deletions')).toBeVisible();
    });
  });
});
