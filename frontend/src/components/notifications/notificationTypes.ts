import type { ElementType } from 'react';
import { UserPlus, Receipt, Bell } from 'lucide-react';
import type { NotificationDTO } from '@/types/notifications';

export interface FormattedNotification {
  icon: ElementType;
  title: string;
  message: string;
  link: string | null;
}

export function formatNotification(notification: NotificationDTO): FormattedNotification {
  const payload =
    typeof notification.payload === 'object' && notification.payload !== null
      ? (notification.payload as Record<string, unknown>)
      : null;

  switch (notification.type) {
    case 'MEMBER_JOINED': {
      const role = typeof payload?.role === 'string' ? payload.role : 'member';
      return {
        icon: UserPlus,
        title: 'New Member Joined',
        message: `A new member joined the trip as ${role.toLowerCase()}.`,
        link: notification.tripId ? `/trips/${notification.tripId}` : null,
      };
    }

    case 'EXPENSE_ADDED': {
      const desc =
        typeof payload?.description === 'string' && payload.description.trim().length > 0
          ? `"${payload.description}"`
          : 'A new expense';
      return {
        icon: Receipt,
        title: 'Expense Added',
        message: `${desc} was added to the trip.`,
        link: notification.tripId ? `/trips/${notification.tripId}/expenses` : null,
      };
    }

    default: {
      // Unknown types render generically without invented navigation
      return {
        icon: Bell,
        title: 'Notification',
        message: 'You have a new notification.',
        link: null,
      };
    }
  }
}
