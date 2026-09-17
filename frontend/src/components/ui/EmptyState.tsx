import React from 'react';
import { cn } from '@/lib/utils';
import { Compass } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-sand-50/50 p-12 text-center',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand-100 text-terracotta-600 mb-4">
        {icon || <Compass className="h-7 w-7" />}
      </div>
      <h4 className="font-serif text-lg font-medium text-sand-900">{title}</h4>
      <p className="mt-1.5 max-w-sm text-sm text-sand-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
