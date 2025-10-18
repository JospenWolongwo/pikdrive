import { ApiError } from './error';
import type { RequestOptions } from './types';
import { supabase } from '@/lib/supabase';

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

    // Note: Authentication is now handled via cookies (credentials: 'include')
    // No need to manually add authorization headers

    // Retry logic for 401 errors (single retry with small delay)
    const maxRetries = 1;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          const apiError = new ApiError(
            response.status,
            response.statusText,
            errorData,
            url
          );

          // For 401 errors, try once more after a short delay
          if (response.status === 401 && attempt < maxRetries) {
            console.warn(`🔄 401 error on attempt ${attempt + 1}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
            lastError = apiError;
            continue;
          }

          throw apiError;
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
        // Re-throw ApiError instances (unless it's a 401 we're retrying)
        if (error instanceof ApiError) {
          if (error.status === 401 && attempt < maxRetries) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
            continue;
          }
          throw error;
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const networkError = new ApiError(
            0,
            'Network Error',
            'Unable to connect to the server. Please check your internet connection.',
            url
          );
          if (attempt < maxRetries) {
            lastError = networkError;
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
            continue;
          }
          throw networkError;
        }

        // Handle other errors
        const unknownError = new ApiError(
          500,
          'Unknown Error',
          error instanceof Error ? error.message : 'An unexpected error occurred',
          url
        );
        if (attempt < maxRetries) {
          lastError = unknownError;
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
          continue;
        }
        throw unknownError;
      }
    }

    // If we get here, all retries failed
    throw lastError || new ApiError(500, 'Request Failed', 'All retry attempts failed', url);
  }

  // Authentication is now handled via cookies - no need for manual auth headers
}
