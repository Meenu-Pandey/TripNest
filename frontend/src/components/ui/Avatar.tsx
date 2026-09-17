import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const AVATAR_COLORS = [
  'bg-terracotta-100 text-terracotta-800 border-terracotta-200',
  'bg-forest-100 text-forest-800 border-forest-200',
  'bg-ocean-100 text-ocean-800 border-ocean-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
];

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = useMemo(() => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    }
    return (parts[0]?.[0] || '?').toUpperCase();
  }, [name]);

  const colorClass = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
  }, [name]);

  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm font-medium',
    lg: 'h-12 w-12 text-base font-medium',
    xl: 'h-16 w-16 text-lg font-medium',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          'inline-block rounded-full object-cover border border-sand-200 shadow-2xs',
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full border select-none',
        sizes[size],
        colorClass,
        className,
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
