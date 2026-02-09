/** Thrown by API-oriented methods; route handlers map statusCode to HTTP status */
export class BookingApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'BookingApiError';
  }
}
