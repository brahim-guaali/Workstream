import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm',
        variant === 'default' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        variant === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        variant === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        variant === 'danger' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        variant === 'info' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        className
      )}
    >
      {children}
    </span>
  );
}
