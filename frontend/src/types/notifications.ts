export type NotificationType = 'MEMBER_JOINED' | 'EXPENSE_ADDED' | string;

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  tripId: string | null;
  payload: unknown;
  read: boolean;
  createdAt: string;
}
