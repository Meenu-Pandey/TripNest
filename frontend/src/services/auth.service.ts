import { apiClient } from '@/lib/apiClient';
import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
  UpdateProfileInput,
  User,
} from '@/types/auth';

export const authService = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>('/api/v1/auth/register', input, {
      skipAuth: true,
    });
    if (data.token) {
      apiClient.setToken(data.token);
    }
    return data;
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const data = await apiClient.post<AuthResponse>('/api/v1/auth/login', input, {
      skipAuth: true,
    });
    if (data.token) {
      apiClient.setToken(data.token);
    }
    return data;
  },

  async getMe(): Promise<User> {
    const response = await apiClient.get<MeResponse>('/api/v1/auth/me');
    return response.user;
  },

  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const response = await apiClient.patch<{ user: User }>('/api/v1/users/me', input);
    return response.user;
  },

  async changePassword(input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/api/v1/auth/change-password', input);
  },

  async forgotPassword(input: { email: string }): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/api/v1/auth/forgot-password', input, {
      skipAuth: true,
    });
  },

  async resetPassword(input: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/api/v1/auth/reset-password', input, {
      skipAuth: true,
    });
  },

  logout(): void {
    apiClient.clearToken();
  },
};
