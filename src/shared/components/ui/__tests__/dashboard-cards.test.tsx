import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Skeleton,
  StatCard,
  ActionCard,
  ListCard,
  ListCardItemRow,
} from '../dashboard-cards';

describe('Skeleton', () => {
  it('should render with default classes', () => {
    const { container } = render(<Skeleton data-testid="skeleton" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.className).toContain('rounded-md');
    expect(skeleton.className).toContain('bg-muted');
  });

  it('should apply custom className', () => {
    const { container } = render(<Skeleton className="h-10 w-10" />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.className).toContain('h-10');
    expect(skeleton.className).toContain('w-10');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} />);
    expect(ref.current).not.toBeNull();
  });
});

describe('StatCard', () => {
  const defaultProps = {
    value: '1,234',
    label: 'Total Users',
  };

  describe('rendering', () => {
    it('should render value and label', () => {
      render(<StatCard {...defaultProps} />);
      expect(screen.getByText('1,234')).toBeInTheDocument();
      expect(screen.getByText('Total Users')).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
      render(
        <StatCard
          {...defaultProps}
          icon={<span data-testid="stat-icon">Icon</span>}
        />
      );
      expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    });

    it('should render trend indicator with up direction', () => {
      render(
        <StatCard
          {...defaultProps}
          trend={{ value: '+12%', direction: 'up', label: 'vs last week' }}
        />
      );
      expect(screen.getByText('+12% vs last week')).toBeInTheDocument();
    });

    it('should render trend indicator with down direction', () => {
      render(
        <StatCard
          {...defaultProps}
          trend={{ value: '-5%', direction: 'down' }}
        />
      );
      expect(screen.getByText('-5%')).toBeInTheDocument();
    });

    it('should render trend indicator with neutral direction', () => {
      render(
        <StatCard
          {...defaultProps}
          trend={{ value: '0%', direction: 'neutral' }}
        />
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should render numeric value', () => {
      render(<StatCard value={42} label="Count" />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('should apply default variant', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:shadow-md');
    });

    it('should apply primary variant', () => {
      const { container } = render(
        <StatCard {...defaultProps} variant="primary" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-accent-primary');
    });

    it('should apply success variant', () => {
      const { container } = render(
        <StatCard {...defaultProps} variant="success" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-success');
    });

    it('should apply warning variant', () => {
      const { container } = render(
        <StatCard {...defaultProps} variant="warning" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-warning');
    });

    it('should apply error variant', () => {
      const { container } = render(
        <StatCard {...defaultProps} variant="error" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-error');
    });
  });

  describe('sizes', () => {
    it('should apply default size (p-6)', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('p-6');
    });

    it('should apply sm size', () => {
      const { container } = render(<StatCard {...defaultProps} size="sm" />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('p-4');
    });

    it('should apply lg size', () => {
      const { container } = render(<StatCard {...defaultProps} size="lg" />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('p-8');
    });
  });

  describe('loading state', () => {
    it('should render skeleton when loading', () => {
      const { container } = render(<StatCard {...defaultProps} loading />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not render value or label when loading', () => {
      render(<StatCard {...defaultProps} loading />);
      expect(screen.queryByText('1,234')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Users')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should be focusable', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('tabIndex')).toBe('0');
    });

    it('should have focus-visible styles', () => {
      const { container } = render(<StatCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('focus-visible:ring-2');
    });
  });

  describe('customization', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <StatCard {...defaultProps} className="custom-class" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-class');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<StatCard {...defaultProps} ref={ref} />);
      expect(ref.current).not.toBeNull();
    });

    it('should pass through HTML attributes', () => {
      render(
        <StatCard {...defaultProps} data-testid="stat-card" id="my-stat" />
      );
      const card = screen.getByTestId('stat-card');
      expect(card.id).toBe('my-stat');
    });
  });
});

describe('ActionCard', () => {
  const defaultProps = {
    title: 'Create New Project',
  };

  describe('rendering', () => {
    it('should render title', () => {
      render(<ActionCard {...defaultProps} />);
      expect(screen.getByText('Create New Project')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(
        <ActionCard
          {...defaultProps}
          description="Start a new project from scratch"
        />
      );
      expect(
        screen.getByText('Start a new project from scratch')
      ).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
      render(
        <ActionCard
          {...defaultProps}
          icon={<span data-testid="action-icon">Icon</span>}
        />
      );
      expect(screen.getByTestId('action-icon')).toBeInTheDocument();
    });

    it('should render action button when provided', () => {
      const onClick = vi.fn();
      render(
        <ActionCard
          {...defaultProps}
          action={{ label: 'Get Started', onClick }}
        />
      );
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('should render action link when href provided', () => {
      render(
        <ActionCard
          {...defaultProps}
          action={{ label: 'Learn More', href: '/docs' }}
        />
      );
      const link = screen.getByText('Learn More');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/docs');
    });
  });

  describe('variants', () => {
    it('should apply default variant', () => {
      const { container } = render(<ActionCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:shadow-md');
    });

    it('should apply primary variant', () => {
      const { container } = render(
        <ActionCard {...defaultProps} variant="primary" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:border-accent-primary');
    });

    it('should apply ghost variant', () => {
      const { container } = render(
        <ActionCard {...defaultProps} variant="ghost" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-transparent');
    });
  });

  describe('sizes', () => {
    it('should apply default size', () => {
      const { container } = render(<ActionCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('p-6');
    });

    it('should apply sm size', () => {
      const { container } = render(<ActionCard {...defaultProps} size="sm" />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('p-4');
    });

    it('should apply lg size', () => {
      const { container } = render(<ActionCard {...defaultProps} size="lg" />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('p-8');
    });
  });

  describe('interaction', () => {
    it('should handle onClick', () => {
      const onClick = vi.fn();
      render(<ActionCard {...defaultProps} onClick={onClick} />);
      fireEvent.click(screen.getByText('Create New Project'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should handle action button onClick', () => {
      const actionClick = vi.fn();
      render(
        <ActionCard
          {...defaultProps}
          action={{ label: 'Click Me', onClick: actionClick }}
        />
      );
      fireEvent.click(screen.getByText('Click Me'));
      expect(actionClick).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard Enter', () => {
      const onClick = vi.fn();
      const { container } = render(
        <ActionCard {...defaultProps} onClick={onClick} />
      );
      const card = container.firstChild as HTMLElement;
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard Space', () => {
      const onClick = vi.fn();
      const { container } = render(
        <ActionCard {...defaultProps} onClick={onClick} />
      );
      const card = container.firstChild as HTMLElement;
      fireEvent.keyDown(card, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not fire onClick when disabled', () => {
      const onClick = vi.fn();
      render(<ActionCard {...defaultProps} onClick={onClick} disabled />);
      fireEvent.click(screen.getByText('Create New Project'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should apply disabled styles', () => {
      const { container } = render(<ActionCard {...defaultProps} disabled />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('opacity-50');
      expect(card.className).toContain('pointer-events-none');
    });

    it('should disable action button when card is disabled', () => {
      render(
        <ActionCard
          {...defaultProps}
          disabled
          action={{ label: 'Click', onClick: vi.fn() }}
        />
      );
      const button = screen.getByText('Click');
      expect(button).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('should render skeleton when loading', () => {
      const { container } = render(<ActionCard {...defaultProps} loading />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not render content when loading', () => {
      render(<ActionCard {...defaultProps} loading />);
      expect(screen.queryByText('Create New Project')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have button role when interactive', () => {
      const { container } = render(
        <ActionCard {...defaultProps} onClick={vi.fn()} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('role')).toBe('button');
    });

    it('should be focusable when interactive', () => {
      const { container } = render(
        <ActionCard {...defaultProps} onClick={vi.fn()} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('tabIndex')).toBe('0');
    });

    it('should not be focusable when disabled', () => {
      const { container } = render(
        <ActionCard {...defaultProps} onClick={vi.fn()} disabled />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.getAttribute('tabIndex')).toBeNull();
    });
  });

  describe('customization', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ActionCard {...defaultProps} className="custom-action" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-action');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ActionCard {...defaultProps} ref={ref} />);
      expect(ref.current).not.toBeNull();
    });
  });
});

describe('ListCard', () => {
  const defaultItems = [
    { id: '1', content: 'Item 1' },
    { id: '2', content: 'Item 2' },
    { id: '3', content: 'Item 3' },
  ];

  describe('rendering', () => {
    it('should render items', () => {
      render(<ListCard items={defaultItems} />);
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should render title when provided', () => {
      render(<ListCard items={defaultItems} title="My List" />);
      expect(screen.getByText('My List')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(
        <ListCard
          items={defaultItems}
          title="My List"
          description="A list of items"
        />
      );
      expect(screen.getByText('A list of items')).toBeInTheDocument();
    });

    it('should render header action when provided', () => {
      render(
        <ListCard
          items={defaultItems}
          title="My List"
          headerAction={<button>View All</button>}
        />
      );
      expect(screen.getByText('View All')).toBeInTheDocument();
    });

    it('should render custom React node as title', () => {
      render(
        <ListCard
          items={defaultItems}
          title={<span data-testid="custom-title">Custom Title</span>}
        />
      );
      expect(screen.getByTestId('custom-title')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should render default empty state when no items', () => {
      render(<ListCard items={[]} />);
      expect(screen.getByText('No items to display')).toBeInTheDocument();
    });

    it('should render custom empty state when provided', () => {
      render(<ListCard items={[]} emptyState={<div>Nothing here yet!</div>} />);
      expect(screen.getByText('Nothing here yet!')).toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should handle item onClick', () => {
      const onClick = vi.fn();
      const items = [{ id: '1', content: 'Clickable Item', onClick }];
      render(<ListCard items={items} />);
      fireEvent.click(screen.getByText('Clickable Item'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should render clickable items as buttons', () => {
      const items = [{ id: '1', content: 'Clickable', onClick: vi.fn() }];
      render(<ListCard items={items} />);
      const button = screen.getByText('Clickable');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should render non-clickable items as divs', () => {
      render(<ListCard items={defaultItems} />);
      const item = screen.getByText('Item 1');
      expect(item.tagName).toBe('DIV');
    });

    it('should disable item when disabled', () => {
      const onClick = vi.fn();
      const items = [
        { id: '1', content: 'Disabled Item', onClick, disabled: true },
      ];
      render(<ListCard items={items} />);
      const button = screen.getByText('Disabled Item');
      expect(button).toBeDisabled();
    });
  });

  describe('scrolling', () => {
    it('should apply maxHeight style', () => {
      const { container } = render(
        <ListCard items={defaultItems} maxHeight={200} />
      );
      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toHaveStyle({ maxHeight: '200px' });
    });

    it('should accept string maxHeight', () => {
      const { container } = render(
        <ListCard items={defaultItems} maxHeight="50vh" />
      );
      const scrollContainer = container.querySelector(
        '.overflow-y-auto'
      ) as HTMLElement;
      expect(scrollContainer.style.maxHeight).toBe('50vh');
    });
  });

  describe('variants', () => {
    it('should apply default variant', () => {
      const { container } = render(<ListCard items={defaultItems} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('rounded-lg');
      expect(card.className).toContain('border');
    });

    it('should apply bordered variant', () => {
      const { container } = render(
        <ListCard items={defaultItems} variant="bordered" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-2');
    });
  });

  describe('loading state', () => {
    it('should render skeleton items when loading', () => {
      const { container } = render(<ListCard items={defaultItems} loading />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render specified number of skeleton items', () => {
      const { container } = render(
        <ListCard items={[]} loading loadingItemCount={5} />
      );
      const skeletonItems = container.querySelectorAll('.border-b');
      expect(skeletonItems.length).toBe(5);
    });

    it('should not render actual items when loading', () => {
      render(<ListCard items={defaultItems} loading />);
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should render items in a list', () => {
      render(<ListCard items={defaultItems} />);
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('should have focus styles on clickable items', () => {
      const items = [{ id: '1', content: 'Focusable', onClick: vi.fn() }];
      render(<ListCard items={items} />);
      const button = screen.getByText('Focusable');
      expect(button.className).toContain('focus-visible:ring-2');
    });
  });

  describe('customization', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ListCard items={defaultItems} className="custom-list" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('custom-list');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ListCard items={defaultItems} ref={ref} />);
      expect(ref.current).not.toBeNull();
    });
  });
});

describe('ListCardItemRow', () => {
  it('should render children', () => {
    render(<ListCardItemRow>Content</ListCardItemRow>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render leading element', () => {
    render(
      <ListCardItemRow leading={<span data-testid="leading">Lead</span>}>
        Content
      </ListCardItemRow>
    );
    expect(screen.getByTestId('leading')).toBeInTheDocument();
  });

  it('should render trailing element', () => {
    render(
      <ListCardItemRow trailing={<span data-testid="trailing">Trail</span>}>
        Content
      </ListCardItemRow>
    );
    expect(screen.getByTestId('trailing')).toBeInTheDocument();
  });

  it('should render both leading and trailing', () => {
    render(
      <ListCardItemRow
        leading={<span data-testid="leading">L</span>}
        trailing={<span data-testid="trailing">T</span>}
      >
        Middle
      </ListCardItemRow>
    );
    expect(screen.getByTestId('leading')).toBeInTheDocument();
    expect(screen.getByTestId('trailing')).toBeInTheDocument();
    expect(screen.getByText('Middle')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ListCardItemRow className="custom-row">Content</ListCardItemRow>
    );
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('custom-row');
    expect(row.className).toContain('flex');
    expect(row.className).toContain('items-center');
  });

  it('should forward ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ListCardItemRow ref={ref}>Content</ListCardItemRow>);
    expect(ref.current).not.toBeNull();
  });
});

describe('composition', () => {
  it('should work with ListCardItemRow inside ListCard items', () => {
    const items = [
      {
        id: '1',
        content: (
          <ListCardItemRow
            leading={<span data-testid="avatar">A</span>}
            trailing={<span data-testid="badge">New</span>}
          >
            <div>
              <div data-testid="name">John Doe</div>
              <div data-testid="email">john@example.com</div>
            </div>
          </ListCardItemRow>
        ),
      },
    ];

    render(<ListCard items={items} title="Users" />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.getByTestId('name')).toBeInTheDocument();
    expect(screen.getByTestId('email')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });
});
