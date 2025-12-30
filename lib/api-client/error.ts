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
    // Extract error message from multiple possible fields
    // Priority: error > message > details > statusText
    const message = typeof data === 'string' 
      ? data 
      : data?.error || data?.message || data?.details || statusText;
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
   * Prioritizes actual error messages from API responses
   */
  getDisplayMessage(): string {
    // First, try to extract actual error message from data
    if (typeof this.data === 'object' && this.data !== null) {
      const actualError = this.data.error || this.data.message || this.data.details;
      if (actualError && typeof actualError === 'string' && actualError.trim()) {
        return actualError;
      }
    }
    
    // If data is a string, use it directly
    if (typeof this.data === 'string' && this.data.trim()) {
      return this.data;
    }
    
    // Fall back to status-based messages if no specific error message found
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
    
    // Use the extracted message (which should have been set in constructor)
    return this.message || 'An error occurred. Please try again.';
  }
}
