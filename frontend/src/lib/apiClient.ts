import type { ApiErrorDetail, ApiErrorResponse, ApiSuccessResponse } from '@/types/api';

const TOKEN_STORAGE_KEY = 'tripnest_auth_token';

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, errorDetail: ApiErrorDetail) {
    super(errorDetail.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = errorDetail.code;
    this.details = errorDetail.details;
  }
}

export interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private getCache = new Map<string, unknown>();

  constructor() {
    // If VITE_API_URL is set, use it; otherwise use empty string so requests hit the Vite proxy
    this.baseUrl = import.meta.env.VITE_API_URL || '';
  }

  public getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  public setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore storage errors
    }
  }

  public clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  public clearCache(): void {
    this.getCache.clear();
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { idempotencyKey, skipAuth, headers: customHeaders, ...restOptions } = options;
    const method = (restOptions.method || 'GET').toUpperCase();

    const headers = new Headers(customHeaders);

    // Set authorization header if token exists and skipAuth is not true
    if (!skipAuth) {
      const token = this.getToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // Set Idempotency-Key if provided
    if (idempotencyKey) {
      headers.set('Idempotency-Key', idempotencyKey);
    }

    // Set JSON content-type if not already set and body is not FormData
    if (
      restOptions.body &&
      !(restOptions.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const cacheKey = `${method}:${url}`;

    // Clear cache on mutating operations
    if (method !== 'GET') {
      this.getCache.clear();
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...restOptions,
        headers,
      });
    } catch (err) {
      throw new ApiClientError(0, {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network connection failed',
      });
    }

    // Handle 304 Not Modified: Return cached response if available
    if (response.status === 304) {
      if (this.getCache.has(cacheKey)) {
        return this.getCache.get(cacheKey) as T;
      }
      // Uncached 304: perform safe re-fetch without conditional headers to obtain fresh data
      const cleanHeaders = new Headers(headers);
      cleanHeaders.delete('If-None-Match');
      cleanHeaders.delete('If-Modified-Since');
      const freshRes = await fetch(url, { ...restOptions, headers: cleanHeaders });
      if (freshRes?.ok) {
        const freshJson = await freshRes.json().catch(() => null);
        const freshResult =
          freshJson && typeof freshJson === 'object' && 'data' in freshJson
            ? freshJson.data
            : freshJson;
        if (freshResult !== undefined && freshResult !== null) {
          this.getCache.set(cacheKey, freshResult);
          return freshResult as T;
        }
      }
      throw new ApiClientError(304, {
        code: 'NOT_MODIFIED',
        message: 'Received 304 Not Modified but no cached representation was available.',
      });
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiClientError(response.status, {
          code: 'HTTP_ERROR',
          message: `Request failed with status ${response.status}`,
        });
      }
      return undefined as unknown as T;
    }

    if (!response.ok) {
      const errorJson = json as Partial<ApiErrorResponse>;
      const errorDetail: ApiErrorDetail = errorJson?.error ?? {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'An unexpected error occurred',
      };

      if (response.status === 401) {
        // Auto-clear invalid token and dispatch event for AuthProvider
        this.clearToken();
        window.dispatchEvent(new CustomEvent('tripnest:unauthorized'));
      }

      throw new ApiClientError(response.status, errorDetail);
    }

    // Backend wraps all successful responses in { success: true, data: T }
    const successJson = json as Partial<ApiSuccessResponse<T>>;
    let result: T;
    if (successJson && typeof successJson === 'object' && 'data' in successJson) {
      result = successJson.data as T;
    } else {
      result = json as T;
    }

    if (method === 'GET') {
      this.getCache.set(cacheKey, result);
    }

    return result;
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  public upload<T>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: formData,
    });
  }
}

export const apiClient = new ApiClient();
