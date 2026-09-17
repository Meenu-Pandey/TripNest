import { apiClient } from '@/lib/apiClient';
import type { PaginatedActivity } from '@/types/activity';

export const activityService = {
  async listActivity(
    tripId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedActivity> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<PaginatedActivity>(`/api/v1/trips/${tripId}/activity${query}`);
  },
};
