import type { SupabaseClient } from '@supabase/supabase-js';

export interface Receipt {
  readonly id: string;
  readonly payment_id: string;
  readonly receipt_number: string;
  readonly issued_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Server-side ReceiptService for use in API routes
 * 
 * SINGLE RESPONSIBILITY: Receipt generation and management
 */
export class ServerReceiptService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a receipt for a payment
   */
  async createReceipt(paymentId: string): Promise<Receipt> {
    try {
      // Check if receipt already exists
      const existing = await this.getReceiptByPaymentId(paymentId);
      if (existing) {
        console.log('[RECEIPT] Receipt already exists for payment:', paymentId);
        return existing;
      }

      // Try to use the RPC function first (it handles duplicates)
      try {
        const { data: receipt, error: rpcError } = await this.supabase
          .rpc('create_receipt', { payment_id_param: paymentId })
          .select()
          .single();

        if (!rpcError && receipt) {
          console.log('[RECEIPT] Receipt created via RPC:', receipt);
          return receipt;
        }

        if (rpcError) {
          console.warn('RPC receipt creation failed, falling back to manual:', rpcError);
        }
      } catch (rpcError) {
        console.warn('RPC receipt creation error, falling back to manual:', rpcError);
      }

      // Fallback: Create receipt manually with duplicate handling
      const receiptNumber = this.generateReceiptNumber();
      const now = new Date().toISOString();

      try {
        const { data: receipt, error } = await this.supabase
          .from('payment_receipts')
          .insert({
            payment_id: paymentId,
            receipt_number: receiptNumber,
            issued_at: now,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          // If it's a duplicate key error, try to fetch the existing receipt
          if (error.code === '23505' && error.message.includes('payment_receipts_payment_id_key')) {
            console.log('[RECEIPT] Duplicate receipt detected, fetching existing receipt for payment:', paymentId);
            const existingReceipt = await this.getReceiptByPaymentId(paymentId);
            if (existingReceipt) {
              return existingReceipt;
            }
          }
          throw new Error(`Failed to create receipt: ${error.message}`);
        }

        console.log('[RECEIPT] Receipt created manually:', receipt);
        return receipt;
      } catch (insertError) {
        // If insert fails due to duplicate, try to fetch existing receipt
        if (insertError instanceof Error && insertError.message.includes('duplicate key')) {
          console.log('[RECEIPT] Duplicate receipt detected during insert, fetching existing receipt for payment:', paymentId);
          const existingReceipt = await this.getReceiptByPaymentId(paymentId);
          if (existingReceipt) {
            return existingReceipt;
          }
        }
        throw insertError;
      }
    } catch (error) {
      console.error('ServerReceiptService.createReceipt error:', error);
      throw error;
    }
  }

  /**
   * Get receipt by payment ID
   */
  async getReceiptByPaymentId(paymentId: string): Promise<Receipt | null> {
    try {
      const { data, error } = await this.supabase
        .from('payment_receipts')
        .select('*')
        .eq('payment_id', paymentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Receipt not found
        }
        throw new Error(`Failed to fetch receipt: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerReceiptService.getReceiptByPaymentId error:', error);
      return null;
    }
  }

  /**
   * Get receipt by receipt number
   */
  async getReceiptByNumber(receiptNumber: string): Promise<Receipt | null> {
    try {
      const { data, error } = await this.supabase
        .from('payment_receipts')
        .select('*')
        .eq('receipt_number', receiptNumber)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Receipt not found
        }
        throw new Error(`Failed to fetch receipt: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('ServerReceiptService.getReceiptByNumber error:', error);
      throw error;
    }
  }

  /**
   * Generate a unique receipt number
   */
  private generateReceiptNumber(): string {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `RECEIPT-${year}-${randomNum}`;
  }
}
