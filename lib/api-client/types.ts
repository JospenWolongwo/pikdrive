/**
 * Request options interface
 */
export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}
