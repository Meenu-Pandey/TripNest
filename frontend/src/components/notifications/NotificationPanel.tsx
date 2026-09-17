import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import type { NotificationDTO } from '@/types/notifications';
import { formatNotification } from './notificationTypes';
import { formatRelativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface NotificationPanelProps {
  notifications: NotificationDTO[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onMarkAsRead: (id: string) => Promise<void>;
  isMarkingRead?: string | null;
  onClose: () => void;
  unreadCount: number;
}

export function NotificationPanel({
  notifications,
  isLoading,
  isError,
  onRetry,
  onMarkAsRead,
  isMarkingRead,
  onClose,
  unreadCount,
}: NotificationPanelProps) {
  const navigate = useNavigate();

  const handleItemClick = async (item: NotificationDTO) => {
    const formatted = formatNotification(item);
    if (!item.read) {
      await onMarkAsRead(item.id);
    }
    if (formatted.link) {
      onClose();
      navigate(formatted.link);
    }
  };

  const handleMarkReadClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await onMarkAsRead(id);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-sand-900/20 backdrop-blur-sm sm:hidden animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={onClose}
      />
      
      <div
        role="dialog"
        aria-label="Notifications Panel"
        className="fixed inset-x-0 bottom-0 top-[auto] max-h-[85vh] rounded-t-3xl sm:absolute sm:inset-auto sm:right-0 sm:mt-2 w-full sm:w-96 sm:rounded-2xl border-t sm:border border-sand-200/80 bg-white shadow-2xl sm:shadow-xl sm:shadow-sand-900/10 z-50 overflow-hidden flex flex-col sm:max-h-[540px] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:fade-in-50 sm:zoom-in-95 duration-300 sm:duration-150"
      >
        {/* Mobile drag handle */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-sand-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand-100 px-5 sm:px-4 py-3 sm:py-3 bg-white sm:bg-sand-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg sm:font-sans sm:font-medium text-sand-950 sm:text-sand-900 sm:text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-terracotta-100 px-2 py-0.5 text-xs font-medium text-terracotta-700">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-sand-100" tabIndex={0}>
          {isLoading && (
            <div className="p-4 space-y-3" role="status" aria-label="Loading notifications">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-9 w-9 rounded-xl bg-sand-200 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 bg-sand-200 rounded w-2/3" />
                    <div className="h-3 bg-sand-100 rounded w-5/6" />
                    <div className="h-2.5 bg-sand-100 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && isError && (
            <div className="p-6 text-center" role="alert">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-sand-900 mb-1">Failed to load notifications</p>
              <p className="text-xs text-sand-500 mb-3">Please try again or check your network.</p>
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 underline"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && notifications.length === 0 && (
            <div className="py-16 px-6 text-center flex flex-col items-center">
              <div className="mb-4 text-sand-300">
                <svg className="w-12 h-12 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[17px] sm:text-[15px] font-serif font-medium text-sand-900 mb-1">You're all caught up.</p>
              <p className="text-sm text-sand-500">No trip activity needs your attention right now.</p>
            </div>
          )}

        {!isLoading &&
          !isError &&
          notifications.length > 0 &&
          notifications.map((item) => {
            const formatted = formatNotification(item);
            const Icon = formatted.icon;
            const isClickable = !!formatted.link || !item.read;

            return (
              <div
                key={item.id}
                onClick={() => isClickable && handleItemClick(item)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && isClickable) {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                role={isClickable ? 'button' : 'listitem'}
                tabIndex={isClickable ? 0 : undefined}
                className={cn(
                  'group flex items-start gap-3 p-3.5 text-left transition-colors',
                  isClickable && 'cursor-pointer hover:bg-sand-50',
                  !item.read && 'bg-sand-50/70',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sand-700 mt-0.5',
                    !item.read
                      ? 'bg-terracotta-100 text-terracotta-700'
                      : 'bg-sand-100 text-sand-500',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p
                      className={cn(
                        'text-xs truncate',
                        !item.read ? 'font-semibold text-sand-900' : 'font-medium text-sand-700',
                      )}
                    >
                      {formatted.title}
                    </p>
                    {!item.read && (
                      <span
                        className="h-2 w-2 rounded-full bg-terracotta-600 shrink-0"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <p className="text-xs text-sand-600 line-clamp-2 leading-relaxed">
                    {formatted.message}
                  </p>
                  <p className="text-[11px] text-sand-400 mt-1">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>

                {/* Mark as read button if unread */}
                {!item.read && (
                  <button
                    type="button"
                    onClick={(e) => handleMarkReadClick(e, item.id)}
                    disabled={isMarkingRead === item.id}
                    title="Mark as read"
                    aria-label="Mark as read"
                    className="shrink-0 p-1.5 rounded-lg text-sand-400 hover:text-terracotta-600 hover:bg-white transition-colors"
                  >
                    {isMarkingRead === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-terracotta-600" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Footer */}
      <div className="border-t border-sand-100 bg-sand-50/50 p-2.5 text-center">
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate('/notifications');
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sand-700 hover:text-terracotta-700 transition-colors py-1 px-3 rounded-lg hover:bg-sand-100"
        >
          <span>View all notifications</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    </>
  );
}
