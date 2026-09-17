import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { notificationsService } from '@/services/notifications.service';
import { formatNotification } from '@/components/notifications/notificationTypes';
import { formatRelativeTime } from '@/lib/dates';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { NotificationDTO } from '@/types/notifications';

type TabFilter = 'all' | 'unread' | 'read';

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', user?.id, { page, pageSize }],
    queryFn: () => notificationsService.listNotifications({ page, pageSize }),
    enabled: !!user,
  });

  const notifications = data?.notifications ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize, total: 0, totalPages: 1 };

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

  const handleItemClick = async (item: NotificationDTO) => {
    const formatted = formatNotification(item);
    if (!item.read) {
      await handleMarkAsRead(item.id);
    }
    if (formatted.link) {
      navigate(formatted.link);
    }
  };

  // Safe filtering on the active page
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'read') return n.read;
    return true;
  });

  const unreadOnPage = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-sand-950">
            Notifications
          </h1>
          <p className="text-sm text-sand-600 mt-1">
            Stay updated on trip activity, invites, and expenses.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center rounded-xl bg-sand-100 p-1 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === 'all'
                ? 'bg-white text-sand-900 shadow-xs'
                : 'text-sand-600 hover:text-sand-900',
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5',
              activeTab === 'unread'
                ? 'bg-white text-sand-900 shadow-xs'
                : 'text-sand-600 hover:text-sand-900',
            )}
          >
            <span>Unread</span>
            {unreadOnPage > 0 && (
              <span className="rounded-full bg-terracotta-100 px-1.5 py-0.2 text-[10px] font-semibold text-terracotta-700">
                {unreadOnPage}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('read')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === 'read'
                ? 'bg-white text-sand-900 shadow-xs'
                : 'text-sand-600 hover:text-sand-900',
            )}
          >
            Read
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="rounded-2xl border border-sand-200/80 bg-white shadow-xs overflow-hidden">
        {isLoading && (
          <div className="p-8 space-y-4" role="status" aria-label="Loading notifications">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-sand-200 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-sand-200 rounded w-1/3" />
                  <div className="h-3.5 bg-sand-100 rounded w-2/3" />
                  <div className="h-3 bg-sand-100 rounded w-1/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="p-12 text-center" role="alert">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <p className="text-base font-medium text-sand-900">Failed to load notifications</p>
            <p className="text-sm text-sand-500 mt-1 mb-4">Please check your connection and retry.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && filteredNotifications.length === 0 && (
          <div className="py-24 px-6 text-center flex flex-col items-center">
            <div className="mb-5 text-sand-300">
              {/* Subtle travel motif - compass/map */}
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xl font-serif font-medium text-sand-900 mb-2">
              {activeTab === 'unread'
                ? 'No unread notifications'
                : activeTab === 'read'
                  ? 'No read notifications yet'
                  : "You're all caught up."}
            </p>
            <p className="text-sm text-sand-500 max-w-sm mx-auto">
              {activeTab === 'unread'
                ? 'All notifications on this page have been read.'
                : 'No trip activity needs your attention right now.'}
            </p>
          </div>
        )}

        {!isLoading && !isError && filteredNotifications.length > 0 && (
          <div className="divide-y divide-sand-100" role="list">
            {filteredNotifications.map((item) => {
              const formatted = formatNotification(item);
              const Icon = formatted.icon;
              const hasLink = !!formatted.link;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 transition-colors',
                    !item.read ? 'bg-sand-50/70' : 'hover:bg-sand-50/40',
                  )}
                  role="listitem"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl mt-0.5',
                        !item.read
                          ? 'bg-terracotta-100 text-terracotta-700'
                          : 'bg-sand-100 text-sand-600',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4
                          className={cn(
                            'text-sm truncate',
                            !item.read ? 'font-semibold text-sand-950' : 'font-medium text-sand-800',
                          )}
                        >
                          {formatted.title}
                        </h4>
                        {!item.read && (
                          <span className="h-2 w-2 rounded-full bg-terracotta-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-sand-600 leading-relaxed mb-1.5">
                        {formatted.message}
                      </p>
                      <p className="text-xs text-sand-400">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!item.read && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMarkAsRead(item.id)}
                        disabled={markingReadId === item.id}
                        leftIcon={
                          markingReadId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-sand-600" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        Mark as read
                      </Button>
                    )}

                    {hasLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleItemClick(item)}
                        rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-sand-100 px-4 py-3 sm:px-6 bg-sand-50/50">
            <span className="text-xs text-sand-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1 || isLoading}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
