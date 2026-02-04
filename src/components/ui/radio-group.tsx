import { cn } from '@/lib/utils';
import React from 'react';

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function RadioGroup({ value, onValueChange, className, children }: RadioGroupProps) {
  return (
    <div role="radiogroup" className={cn('space-y-2', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<RadioGroupItemProps>, {
            checked: child.props.value === value,
            onCheckedChange: () => onValueChange(child.props.value),
          });
        }
        return child;
      })}
    </div>
  );
}

interface RadioGroupItemProps {
  value: string;
  id?: string;
  checked?: boolean;
  onCheckedChange?: () => void;
  className?: string;
}

export function RadioGroupItem({ id, checked, onCheckedChange, className }: RadioGroupItemProps) {
  return (
    <button
      type="button"
      role="radio"
      id={id}
      aria-checked={checked}
      onClick={onCheckedChange}
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {checked && (
        <span className="flex items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </span>
      )}
    </button>
  );
}
