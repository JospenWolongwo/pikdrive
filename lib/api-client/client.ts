import { ApiError } from './error';
import type { RequestOptions } from './types';

/**
 * Simple, robust API client for internal API calls
 * Handles authentication, error handling, and type safety
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make an authenticated GET request
   */
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Make an authenticated POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * Make an authenticated PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  /**
   * Make an authenticated DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Core request method with error handling and authentication
   */
  private async request<T>(endpoint: string, options: RequestInit & RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Merge headers
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    // Add authentication if available
    const authHeaders = await this.getAuthHeaders();
    Object.assign(headers, authHeaders);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Ensure cookies are included for authentication
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      if (!response.ok) {
        const errorData = isJson ? await response.json() : await response.text();
        throw new ApiError(
          response.status,
          response.statusText,
          errorData,
          url
        );
      }

      // Return empty response for 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      // Parse response based on content type
      if (isJson) {
        return await response.json();
      } else {
        return (await response.text()) as T;
      }

    } catch (error) {
      // Re-throw ApiError instances
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          0,
          'Network Error',
          'Unable to connect to the server. Please check your internet connection.',
          url
        );
      }

      // Handle other errors
      throw new ApiError(
        500,
        'Unknown Error',
        error instanceof Error ? error.message : 'An unexpected error occurred',
        url
      );
    }
  }

  /**
   * Get authentication headers (cookies are automatically included by fetch)
   * This method can be extended to add custom auth headers if needed
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    // Cookies are automatically included by fetch in browser environment
    // For server-side requests, we might need to pass auth headers explicitly
    return {};
  }
}
