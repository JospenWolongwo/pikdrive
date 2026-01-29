import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppTemplateRequest, WhatsAppMessageResponse } from '@/types/notification';

/**
 * Server-side WhatsApp Notification Service
 * 
 * SINGLE RESPONSIBILITY: Send WhatsApp messages via Meta WhatsApp Business API
 * Handles template messages, phone number formatting, and error handling
 */
export class ServerWhatsAppNotificationService {
  private edgeFunctionUrl: string;

  constructor(private supabase: SupabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-whatsapp-message`;
    console.log('[WHATSAPP] Edge Function URL configured:', this.edgeFunctionUrl);
  }

  /**
   * Format phone number to E.164 format required by WhatsApp API
   * Cameroon format: +237XXXXXXXXX
   */
  formatPhoneNumber(phone: string | null | undefined): string | null {
    if (!phone) {
      return null;
    }

    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If already starts with country code, ensure + prefix
    if (digits.startsWith('237')) {
      return `+${digits}`;
    }

    // If starts with 0, replace with +237
    if (digits.startsWith('0')) {
      return `+237${digits.substring(1)}`;
    }

    // If 9 digits (Cameroon mobile), add +237
    if (digits.length === 9) {
      return `+237${digits}`;
    }

    // If already in E.164 format, return as is
    if (phone.startsWith('+')) {
      return phone;
    }

    // Default: assume Cameroon and add +237
    return `+237${digits}`;
  }

  /**
   * Validate template variables match expected count
   */
  validateTemplateVariables(templateName: string, variables: readonly string[]): void {
    // Template variable count mapping
    const templateVariableCounts: Record<string, number> = {
      booking_confirmation: 8, // passenger_name, route, departure_time, pickup_point_name, pickup_time, seats, amount, verification_code
      payment_confirmed: 4, // passenger_name, amount, route, transaction_id
      driver_new_booking: 7, // driver_name, passenger_name, route, seats, amount, pickup_point_name, pickup_time
      ride_reminder: 5, // user_name, route, departure_time, pickup_point_name, pickup_time
      pickup_point_update: 5, // passenger_name, driver_name, current_pickup_point, estimated_arrival, route
      payment_failed: 4, // passenger_name, amount, reason, retry_link
      booking_cancelled: 4, // user_name, route, refund_amount, refund_status
    };

    const expectedCount = templateVariableCounts[templateName];
    if (expectedCount === undefined) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    if (variables.length !== expectedCount) {
      throw new Error(
        `Template ${templateName} requires ${expectedCount} variables, got ${variables.length}`
      );
    }
  }

  /**
   * Send WhatsApp template message with retry logic
   */
  async sendTemplateMessage(
    request: WhatsAppTemplateRequest,
    retryCount: number = 0,
    maxRetries: number = 3
  ): Promise<WhatsAppMessageResponse> {
    try {
      // Format phone number
      const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
      if (!formattedPhone) {
        throw new Error('Phone number is required and must be valid');
      }

      // Validate template variables
      this.validateTemplateVariables(request.templateName, request.variables);

      console.log('[WHATSAPP] Calling Edge Function:', {
        url: this.edgeFunctionUrl,
        templateName: request.templateName,
        phoneNumber: formattedPhone,
        variableCount: request.variables.length,
        retryAttempt: retryCount,
      });

      // Get service role key for authentication
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error('[WHATSAPP] SUPABASE_SERVICE_ROLE_KEY not configured');
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      }

      // Call Edge Function
      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({
          templateName: request.templateName,
          phoneNumber: formattedPhone,
          variables: request.variables,
          language: request.language || 'fr',
        }),
      });

      console.log('[WHATSAPP] Edge Function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorCode = errorData.errorCode || response.status;
        const isRateLimit = errorCode === 429;

        // Retry on rate limits if we haven't exceeded max retries
        if (isRateLimit && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[WHATSAPP] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.sendTemplateMessage(request, retryCount + 1, maxRetries);
        }

        console.error('[WHATSAPP] Edge Function error response:', errorData);
        throw new Error(errorData.error || 'Failed to send WhatsApp message');
      }

      const result = await response.json();

      console.log('[WHATSAPP] Edge Function response:', {
        success: result.success,
        messageId: result.messageId,
        status: result.status,
      });

      return {
        success: result.success || true,
        messageId: result.messageId,
        status: result.status,
        error: result.error,
        errorCode: result.errorCode,
      };
    } catch (error) {
      // Don't retry on non-rate-limit errors
      const isRateLimit = error instanceof Error && error.message.includes('429');
      if (isRateLimit && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`[WHATSAPP] Retrying after error in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendTemplateMessage(request, retryCount + 1, maxRetries);
      }

      console.error('[WHATSAPP] Detailed error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        request: {
          templateName: request.templateName,
          phoneNumber: request.phoneNumber,
        },
        retryAttempt: retryCount,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send WhatsApp message',
      };
    }
  }

  /**
   * Handle API errors with retry logic
   * Implements exponential backoff for rate limits (429 errors)
   */
  async handleApiError(
    error: any,
    retryCount: number = 0,
    maxRetries: number = 3
  ): Promise<never> {
    const isRateLimit = error.errorCode === 429 || error.status === 429;
    const shouldRetry = isRateLimit && retryCount < maxRetries;

    if (shouldRetry) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
      console.log(`[WHATSAPP] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      throw error; // Re-throw to trigger retry in calling code
    }

    // Don't retry for other errors or max retries reached
    throw error;
  }
}
