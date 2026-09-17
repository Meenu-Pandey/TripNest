import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'terracotta'
    | 'forest'
    | 'ocean'
    | 'success'
    | 'warning'
    | 'danger'
    | 'outline';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-sand-100 text-sand-800 border-transparent',
    terracotta: 'bg-terracotta-50 text-terracotta-800 border-terracotta-200',
    forest: 'bg-forest-50 text-forest-800 border-forest-200',
    ocean: 'bg-ocean-50 text-ocean-800 border-ocean-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    outline: 'bg-transparent text-sand-700 border-sand-300',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
