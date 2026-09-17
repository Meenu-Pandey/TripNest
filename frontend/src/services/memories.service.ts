import { apiClient } from '@/lib/apiClient';
import type { PaginationMeta } from '@/types/api';
import type { MemoryPhotoDTO } from '@/types/memories';

export const memoriesService = {
  async listMemories(
    tripId: string,
    params: { page?: number; pageSize?: number } = {},
  ): Promise<{ memories: MemoryPhotoDTO[]; pagination: PaginationMeta }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<{ memories: MemoryPhotoDTO[]; pagination: PaginationMeta }>(
      `/api/v1/trips/${tripId}/memories${query}`,
    );
  },

  async uploadMemory(
    tripId: string,
    photoFile: File,
    caption?: string,
    placeId?: string,
  ): Promise<MemoryPhotoDTO> {
    const formData = new FormData();
    formData.append('photo', photoFile);
    if (caption) formData.append('caption', caption);
    if (placeId) formData.append('placeId', placeId);

    const res = await apiClient.upload<{ memory: MemoryPhotoDTO }>(
      `/api/v1/trips/${tripId}/memories`,
      formData,
    );
    return res.memory;
  },

  async deleteMemory(tripId: string, memoryId: string): Promise<{ id: string }> {
    return apiClient.delete<{ id: string }>(
      `/api/v1/trips/${tripId}/memories/${memoryId}`,
    );
  },
};
