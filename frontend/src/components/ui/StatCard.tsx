import React from 'react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon: React.ReactNode;
  accentColor?: 'terracotta' | 'forest' | 'ocean' | 'sand' | 'amber';
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  accentColor = 'sand',
  className,
  onClick,
}: StatCardProps) {
  const colorMap = {
    terracotta: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200/70',
    forest: 'bg-forest-50 text-forest-700 border-forest-200/70',
    ocean: 'bg-ocean-50 text-ocean-700 border-ocean-200/70',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/70',
    sand: 'bg-sand-100 text-sand-800 border-sand-200/80',
  }[accentColor];

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border border-sand-200/90 bg-white p-5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-card',
        onClick && 'cursor-pointer w-full',
        className,
      )}
    >
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-105', colorMap)}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sand-500">
          {label}
        </p>
        <div className="mt-0.5 font-serif text-2xl font-bold tracking-tight text-sand-900 truncate">
          {value}
        </div>
        {subtext && (
          <p className="text-xs text-sand-500 truncate mt-0.5">
            {subtext}
          </p>
        )}
      </div>
    </Component>
  );
}
