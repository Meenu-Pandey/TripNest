import { apiClient } from '@/lib/apiClient';
import type { PaginationMeta } from '@/types/api';
import type { NotificationDTO } from '@/types/notifications';

export const notificationsService = {
  async listNotifications(
    params: { page?: number; pageSize?: number } = {},
  ): Promise<{ notifications: NotificationDTO[]; pagination: PaginationMeta }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<{ notifications: NotificationDTO[]; pagination: PaginationMeta }>(
      `/api/v1/notifications${query}`,
    );
  },

  async fetchAllNotifications(): Promise<NotificationDTO[]> {
    let currentPage = 1;
    let totalPages = 1;
    const allNotifications: NotificationDTO[] = [];

    while (currentPage <= totalPages) {
      const res = await this.listNotifications({ page: currentPage, pageSize: 50 });
      allNotifications.push(...res.notifications);
      totalPages = res.pagination.totalPages;
      currentPage += 1;
    }

    return allNotifications;
  },

  async markAsRead(notificationId: string): Promise<NotificationDTO> {
    const res = await apiClient.patch<{ notification: NotificationDTO }>(
      `/api/v1/notifications/${notificationId}/read`,
    );
    return res.notification;
  },
};
