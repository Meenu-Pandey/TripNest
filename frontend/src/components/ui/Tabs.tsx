import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className,
  variant = 'underline',
}: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className={cn('flex space-x-1 rounded-xl bg-sand-100/80 p-1', className)}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'bg-white text-sand-900 shadow-xs'
                  : 'text-sand-600 hover:text-sand-900 hover:bg-white/50',
              )}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-1.5 py-0.2 text-[10px]',
                    isActive ? 'bg-terracotta-100 text-terracotta-800' : 'bg-sand-200 text-sand-700',
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('border-b border-sand-200', className)}>
      <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-none" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'group inline-flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'border-terracotta-600 text-terracotta-600'
                  : 'border-transparent text-sand-500 hover:border-sand-300 hover:text-sand-700',
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-terracotta-600' : 'text-sand-400 group-hover:text-sand-500',
                  )}
                >
                  {tab.icon}
                </span>
              )}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-2 py-0.5 text-xs',
                    isActive ? 'bg-terracotta-50 text-terracotta-700 font-semibold' : 'bg-sand-100 text-sand-600',
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
