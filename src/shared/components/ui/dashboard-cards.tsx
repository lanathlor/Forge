import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

// Performance optimization: memoization
const { memo } = React;

// =============================================================================
// Skeleton Component (for loading states)
// =============================================================================

const Skeleton = memo(
  React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('animate-pulse rounded-md bg-muted', className)}
        {...props}
      />
    )
  )
);
Skeleton.displayName = 'Skeleton';

// =============================================================================
// Shared Icons (small inline SVGs)
// =============================================================================

const ChevronRightIcon = memo(({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
));
ChevronRightIcon.displayName = 'ChevronRightIcon';

const TrendUpIcon = memo(() => (
  <svg
    className="h-3 w-3"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
));
TrendUpIcon.displayName = 'TrendUpIcon';

const TrendDownIcon = memo(() => (
  <svg
    className="h-3 w-3"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
));
TrendDownIcon.displayName = 'TrendDownIcon';

// =============================================================================
// StatCard - For metrics with icon, value, label, trend indicator
// =============================================================================

const statCardVariants = cva(
  'relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.99]',
  {
    variants: {
      variant: {
        default: 'hover:shadow-md hover:border-border-strong',
        primary:
          'border-accent-primary/20 bg-accent-primary/5 hover:border-accent-primary/40 hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)]',
        success:
          'border-success/20 bg-success/5 hover:border-success/40 hover:shadow-[0_4px_20px_rgba(22,163,74,0.15)]',
        warning:
          'border-warning/20 bg-warning/5 hover:border-warning/40 hover:shadow-[0_4px_20px_rgba(245,158,11,0.15)]',
        error:
          'border-error/20 bg-error/5 hover:border-error/40 hover:shadow-[0_4px_20px_rgba(239,68,68,0.15)]',
      },
      size: {
        default: 'p-6',
        sm: 'p-4',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const trendVariants = cva(
  'inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5',
  {
    variants: {
      trend: {
        up: 'text-success bg-success/10',
        down: 'text-error bg-error/10',
        neutral: 'text-text-muted bg-muted',
      },
    },
    defaultVariants: {
      trend: 'neutral',
    },
  }
);

export interface StatCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  trend?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  loading?: boolean;
}

interface StatCardSkeletonProps {
  className: string;
  variant: StatCardProps['variant'];
  size: StatCardProps['size'];
}

const StatCardSkeleton = memo(
  React.forwardRef<
    HTMLDivElement,
    StatCardSkeletonProps & React.HTMLAttributes<HTMLDivElement>
  >(({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(statCardVariants({ variant, size, className }))}
      {...props}
    >
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  ))
);
StatCardSkeleton.displayName = 'StatCardSkeleton';

interface TrendBadgeProps {
  trend: NonNullable<StatCardProps['trend']>;
}

const TrendBadge = memo(({ trend }: TrendBadgeProps) => (
  <div className={cn(trendVariants({ trend: trend.direction }))}>
    {trend.direction === 'up' && <TrendUpIcon />}
    {trend.direction === 'down' && <TrendDownIcon />}
    <span>
      {trend.value}
      {trend.label && ` ${trend.label}`}
    </span>
  </div>
));
TrendBadge.displayName = 'TrendBadge';

const StatCard = memo(
  React.forwardRef<HTMLDivElement, StatCardProps>(
    (
      {
        className,
        variant,
        size,
        icon,
        value,
        label,
        trend,
        loading,
        ...props
      },
      ref
    ) => {
      if (loading) {
        return (
          <StatCardSkeleton
            ref={ref}
            className={className ?? ''}
            variant={variant}
            size={size}
            {...props}
          />
        );
      }

      const ariaLabel = `${label}: ${value}${trend ? `, trend ${trend.direction} ${trend.value}` : ''}`;

      return (
        <div
          ref={ref}
          className={cn(
            statCardVariants({ variant, size, className }),
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
          tabIndex={0}
          role="region"
          aria-label={ariaLabel}
          {...props}
        >
          <div className="flex items-start justify-between">
            {icon && (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                {icon}
              </div>
            )}
            {trend && <TrendBadge trend={trend} />}
          </div>
          <div className={cn('mt-4', !icon && !trend && 'mt-0')}>
            <div className="text-2xl font-bold tracking-tight text-text-primary">
              {value}
            </div>
            <p className="mt-1 text-sm text-text-muted">{label}</p>
          </div>
        </div>
      );
    }
  )
);
StatCard.displayName = 'StatCard';

// =============================================================================
// ActionCard - For primary actions with icon, title, description, CTA
// =============================================================================

const actionCardVariants = cva(
  'group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:scale-[1.01] hover:-translate-y-0.5 active:scale-[0.99]',
  {
    variants: {
      variant: {
        default: 'hover:shadow-md hover:border-border-strong',
        primary:
          'border-accent-primary/20 hover:border-accent-primary hover:bg-accent-primary/5 hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)]',
        ghost: 'border-transparent hover:border-border hover:bg-muted/50',
      },
      size: {
        default: 'p-6',
        sm: 'p-4',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ActionCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof actionCardVariants> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  disabled?: boolean;
  loading?: boolean;
}

interface ActionCardSkeletonProps {
  className: string;
  variant: ActionCardProps['variant'];
  size: ActionCardProps['size'];
  hasAction: boolean;
}

const ActionCardSkeleton = memo(
  React.forwardRef<
    HTMLDivElement,
    ActionCardSkeletonProps & React.HTMLAttributes<HTMLDivElement>
  >(({ className, variant, size, hasAction, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(actionCardVariants({ variant, size, className }))}
      {...props}
    >
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      {hasAction && (
        <div className="mt-4 border-t border-border pt-4">
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  ))
);
ActionCardSkeleton.displayName = 'ActionCardSkeleton';

interface ActionCardIconProps {
  icon: React.ReactNode;
  variant: ActionCardProps['variant'];
}

const ActionCardIcon = memo(({ icon, variant }: ActionCardIconProps) => (
  <div
    className={cn(
      'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-110',
      variant === 'primary'
        ? 'bg-accent-primary/10 text-accent-primary group-hover:rotate-3 group-hover:bg-accent-primary/20'
        : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
    )}
  >
    {icon}
  </div>
));
ActionCardIcon.displayName = 'ActionCardIcon';

interface ActionCardLinkProps {
  href: string;
  label: string;
  disabled?: boolean;
}

const ActionCardLink = memo(
  ({ href, label, disabled }: ActionCardLinkProps) => (
    <a
      href={href}
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium text-accent-primary transition-colors hover:text-accent-primary-hover',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      {label}
      <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </a>
  )
);
ActionCardLink.displayName = 'ActionCardLink';

interface ActionCardButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

const ActionCardButton = memo(
  ({ label, onClick, disabled }: ActionCardButtonProps) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium text-accent-primary transition-colors hover:text-accent-primary-hover',
        'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      {label}
      <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </button>
  )
);
ActionCardButton.displayName = 'ActionCardButton';

interface ActionCardContentProps {
  icon?: React.ReactNode;
  variant: ActionCardProps['variant'];
  title: string;
  description?: string;
  action?: ActionCardProps['action'];
  disabled?: boolean;
  isInteractive: boolean;
}

const ActionCardContent = memo(
  ({
    icon,
    variant,
    title,
    description,
    action,
    disabled,
    isInteractive,
  }: ActionCardContentProps) => (
    <>
      <div className="flex items-start gap-4">
        {icon && <ActionCardIcon icon={icon} variant={variant} />}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text-primary transition-colors group-hover:text-accent-primary">
            {title}
          </h3>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm text-text-muted">
              {description}
            </p>
          )}
        </div>
        {isInteractive && !action && (
          <ChevronRightIcon className="h-5 w-5 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-text-primary" />
        )}
      </div>
      {action && (
        <div className="mt-4 border-t border-border pt-4">
          {action.href ? (
            <ActionCardLink
              href={action.href}
              label={action.label}
              disabled={disabled}
            />
          ) : (
            <ActionCardButton
              label={action.label}
              onClick={action.onClick}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </>
  )
);
ActionCardContent.displayName = 'ActionCardContent';

function createActionCardKeyHandler(
  onClick?: React.MouseEventHandler<HTMLDivElement>
) {
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };
}

function getActionCardClassName(
  variant: ActionCardProps['variant'],
  size: ActionCardProps['size'],
  className: string | undefined,
  isInteractive: boolean,
  disabled?: boolean
) {
  return cn(
    actionCardVariants({ variant, size, className }),
    isInteractive && 'cursor-pointer',
    disabled && 'pointer-events-none opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  );
}

function isActionCardInteractive(
  onClick?: React.MouseEventHandler<HTMLDivElement>,
  action?: ActionCardProps['action']
) {
  return !!onClick || !!action?.onClick || !!action?.href;
}

function getActionCardInteractiveProps(
  isInteractive: boolean,
  disabled?: boolean,
  onClick?: React.MouseEventHandler<HTMLDivElement>
) {
  if (!isInteractive) {
    return {};
  }
  const isEnabled = !disabled;
  return {
    onClick: isEnabled ? onClick : undefined,
    tabIndex: isEnabled ? 0 : undefined,
    role: 'button' as const,
    onKeyDown: isEnabled ? createActionCardKeyHandler(onClick) : undefined,
  };
}

const ActionCard = memo(
  React.forwardRef<HTMLDivElement, ActionCardProps>(
    (
      {
        className,
        variant,
        size,
        icon,
        title,
        description,
        action,
        disabled,
        loading,
        onClick,
        ...props
      },
      ref
    ) => {
      const isInteractive = isActionCardInteractive(onClick, action);

      if (loading) {
        return (
          <ActionCardSkeleton
            ref={ref}
            className={className ?? ''}
            variant={variant}
            size={size}
            hasAction={!!action}
            {...props}
          />
        );
      }

      const interactiveProps = getActionCardInteractiveProps(
        isInteractive,
        disabled,
        onClick
      );

      return (
        <div
          ref={ref}
          className={getActionCardClassName(
            variant,
            size,
            className,
            isInteractive,
            disabled
          )}
          {...interactiveProps}
          {...props}
        >
          <ActionCardContent
            icon={icon}
            variant={variant}
            title={title}
            description={description}
            action={action}
            disabled={disabled}
            isInteractive={isInteractive}
          />
        </div>
      );
    }
  )
);
ActionCard.displayName = 'ActionCard';

// =============================================================================
// ListCard - For scrollable item lists with headers
// =============================================================================

const listCardVariants = cva(
  'rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden',
  {
    variants: {
      variant: {
        default: '',
        bordered: 'border-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface ListCardItem {
  id: string;
  content: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export interface ListCardProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof listCardVariants> {
  title?: React.ReactNode;
  description?: string;
  items: ListCardItem[];
  maxHeight?: string | number;
  emptyState?: React.ReactNode;
  headerAction?: React.ReactNode;
  loading?: boolean;
  loadingItemCount?: number;
}

interface ListCardHeaderProps {
  title?: React.ReactNode;
  description?: string;
  headerAction?: React.ReactNode;
}

const ListCardHeader = memo(
  ({ title, description, headerAction }: ListCardHeaderProps) => (
    <div className="flex items-center justify-between border-b border-border p-4">
      <div>
        {title && <h3 className="font-semibold text-text-primary">{title}</h3>}
        {description && (
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        )}
      </div>
      {headerAction}
    </div>
  )
);
ListCardHeader.displayName = 'ListCardHeader';

interface ListCardSkeletonProps {
  className: string;
  variant: ListCardProps['variant'];
  maxHeight: string | number;
  loadingItemCount: number;
  hasHeader: boolean;
  hasDescription: boolean;
  hasHeaderAction: boolean;
}

const ListCardSkeletonItem = memo(() => (
  <div className="border-b border-border p-4 last:border-b-0">
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  </div>
));
ListCardSkeletonItem.displayName = 'ListCardSkeletonItem';

const ListCardSkeleton = memo(
  React.forwardRef<
    HTMLDivElement,
    ListCardSkeletonProps & React.HTMLAttributes<HTMLDivElement>
  >(
    (
      {
        className,
        variant,
        maxHeight,
        loadingItemCount,
        hasHeader,
        hasDescription,
        hasHeaderAction,
        ...props
      },
      ref
    ) => (
      <div
        ref={ref}
        className={cn(listCardVariants({ variant, className }))}
        {...props}
      >
        {hasHeader && (
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              {hasDescription && <Skeleton className="h-4 w-48" />}
            </div>
            {hasHeaderAction && <Skeleton className="h-8 w-20" />}
          </div>
        )}
        <div
          className="overflow-y-auto"
          style={{
            maxHeight:
              typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          }}
        >
          {Array.from({ length: loadingItemCount }).map((_, i) => (
            <ListCardSkeletonItem key={i} />
          ))}
        </div>
      </div>
    )
  )
);
ListCardSkeleton.displayName = 'ListCardSkeleton';

interface ListCardListItemProps {
  item: ListCardItem;
}

const ListCardListItem = memo(({ item }: ListCardListItemProps) => {
  if (item.onClick) {
    return (
      <button
        onClick={item.onClick}
        disabled={item.disabled}
        className={cn(
          'w-full p-4 text-left transition-all duration-200',
          'hover:bg-surface-interactive hover:pl-5 focus-visible:bg-surface-interactive focus-visible:pl-5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          'active:scale-[0.99]',
          item.disabled && 'pointer-events-none opacity-50'
        )}
      >
        {item.content}
      </button>
    );
  }
  return (
    <div
      className={cn(
        'p-4 transition-opacity duration-200',
        item.disabled && 'opacity-50'
      )}
    >
      {item.content}
    </div>
  );
});
ListCardListItem.displayName = 'ListCardListItem';

function formatMaxHeight(maxHeight: string | number): string {
  return typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;
}

interface ListCardEmptyProps {
  emptyState?: React.ReactNode;
}

const ListCardEmpty = memo(({ emptyState }: ListCardEmptyProps) => (
  <div className="flex items-center justify-center p-8 text-center">
    {emptyState || (
      <p className="text-sm text-text-muted">No items to display</p>
    )}
  </div>
));
ListCardEmpty.displayName = 'ListCardEmpty';

interface ListCardItemsProps {
  items: ListCardItem[];
}

const ListCardItems = memo(({ items }: ListCardItemsProps) => (
  <ul className="divide-y divide-border">
    {items.map((item) => (
      <li key={item.id}>
        <ListCardListItem item={item} />
      </li>
    ))}
  </ul>
));
ListCardItems.displayName = 'ListCardItems';

const ListCard = memo(
  React.forwardRef<HTMLDivElement, ListCardProps>(
    (
      {
        className,
        variant,
        title,
        description,
        items,
        maxHeight = 320,
        emptyState,
        headerAction,
        loading,
        loadingItemCount = 3,
        ...props
      },
      ref
    ) => {
      const hasHeader = !!(title || description || headerAction);

      if (loading) {
        return (
          <ListCardSkeleton
            ref={ref}
            className={className ?? ''}
            variant={variant}
            maxHeight={maxHeight}
            loadingItemCount={loadingItemCount}
            hasHeader={hasHeader}
            hasDescription={!!description}
            hasHeaderAction={!!headerAction}
            {...props}
          />
        );
      }

      return (
        <div
          ref={ref}
          className={cn(listCardVariants({ variant, className }))}
          {...props}
        >
          {hasHeader && (
            <ListCardHeader
              title={title}
              description={description}
              headerAction={headerAction}
            />
          )}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: formatMaxHeight(maxHeight) }}
          >
            {items.length === 0 ? (
              <ListCardEmpty emptyState={emptyState} />
            ) : (
              <ListCardItems items={items} />
            )}
          </div>
        </div>
      );
    }
  )
);
ListCard.displayName = 'ListCard';

// =============================================================================
// ListCardItem Components (for flexible list item composition)
// =============================================================================

export interface ListCardItemRowProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

const ListCardItemRow = memo(
  React.forwardRef<HTMLDivElement, ListCardItemRowProps>(
    ({ className, leading, trailing, children, ...props }, ref) => (
      <div
        ref={ref}
        className={cn('flex items-center gap-3', className)}
        {...props}
      >
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">{children}</div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    )
  )
);
ListCardItemRow.displayName = 'ListCardItemRow';

// =============================================================================
// Exports
// =============================================================================

export {
  Skeleton,
  StatCard,
  statCardVariants,
  ActionCard,
  actionCardVariants,
  ListCard,
  listCardVariants,
  ListCardItemRow,
  trendVariants,
};
