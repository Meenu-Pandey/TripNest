import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { notificationsService } from '@/services/notifications.service';
import { NotificationPanel } from './NotificationPanel';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user?.id, 'all'],
    queryFn: () => notificationsService.fetchAllNotifications(),
    enabled: !!user,
    staleTime: 15000,
    refetchInterval: 30000, // conservative 30s polling
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      setMarkingReadId(id);
      try {
        await notificationsService.markAsRead(id);
      } finally {
        setMarkingReadId(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  const handleMarkAsRead = async (id: string) => {
    await markReadMutation.mutateAsync(id);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      refetch();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          'relative rounded-lg p-2 text-sand-500 hover:bg-sand-100 hover:text-sand-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-terracotta-500/30',
          isOpen && 'bg-sand-100 text-sand-900',
        )}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-600 px-1 text-[10px] font-bold text-white shadow-xs"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          onMarkAsRead={handleMarkAsRead}
          isMarkingRead={markingReadId}
          onClose={() => setIsOpen(false)}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
}
