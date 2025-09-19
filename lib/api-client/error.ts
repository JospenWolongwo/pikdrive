/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: any,
    public url: string
  ) {
    const message = typeof data === 'string' ? data : data?.message || statusText;
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Check if the error is a client error (4xx)
   */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if the error is a server error (5xx)
   */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /**
   * Check if the error is an authentication error
   */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /**
   * Get formatted error message for display
   */
  getDisplayMessage(): string {
    if (this.isAuthError) {
      return 'Authentication required. Please log in again.';
    }
    
    if (this.isServerError) {
      return 'Server error. Please try again later.';
    }
    
    if (this.status === 404) {
      return 'The requested resource was not found.';
    }
    
    if (this.status === 0) {
      return 'Network error. Please check your connection.';
    }
    
    return this.message || 'An error occurred. Please try again.';
  }
}
