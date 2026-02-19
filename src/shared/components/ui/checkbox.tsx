'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  labelClassName?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, labelClassName, label, checked, onCheckedChange, onChange, onClick, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Stop propagation to prevent parent click handlers
      e.stopPropagation();
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      // Stop propagation to prevent parent click handlers
      e.stopPropagation();
      onClick?.(e);
    };

    const handleLabelClick = (e: React.MouseEvent<HTMLLabelElement>) => {
      // Stop propagation to prevent parent click handlers
      e.stopPropagation();
    };

    return (
      <label
        className={cn(
          'relative inline-flex cursor-pointer items-center',
          label && 'gap-2'
        )}
        onClick={handleLabelClick}
      >
        <input
          type="checkbox"
          className="peer sr-only"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          onClick={handleClick}
          {...props}
        />
        <div
          className={cn(
            'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-input bg-background ring-offset-background transition-colors',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground',
            className
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </div>
        {label && (
          <span className={cn('select-none', labelClassName)}>
            {label}
          </span>
        )}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
