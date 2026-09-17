import React from 'react';
import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  icon,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-terracotta-600">{icon}</div>}
          <h3 className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-sand-950">
            {title}
          </h3>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs sm:text-sm text-sand-600 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
    </div>
  );
}
