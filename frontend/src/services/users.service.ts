import { apiClient } from '@/lib/apiClient';
import type { PublicUser, UpdateUserProfileInput } from '@/types/users';

export const usersService = {
  async updateMe(input: UpdateUserProfileInput): Promise<PublicUser> {
    const response = await apiClient.patch<{ user: PublicUser }>('/api/v1/users/me', input);
    return response.user;
  },
};
