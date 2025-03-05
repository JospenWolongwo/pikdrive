import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { formatCurrency } from "@/lib/utils";

export interface Receipt {
  id: string;
  receipt_number: string;
  issued_at: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
  payment: {
    amount: number;
    currency: string;
    phone_number: string;
    transaction_id: string;
    status: string;
    booking: {
      seats: number;
      ride: {
        from_city: string;
        to_city: string;
        departure_time: string;
      };
    };
  };
}

export class ReceiptService {
  static async getReceipt(paymentId: string): Promise<Receipt | null> {
    const supabase = createServerComponentClient({ cookies });
    
    console.log('🧾 Fetching receipt for payment:', paymentId);

    // First just get the receipt
    const { data: receipt, error } = await supabase
      .from('payment_receipts')
      .select('id, receipt_number, issued_at, created_at, updated_at, pdf_url, payment_id')
      .eq('payment_id', paymentId)
      .single();

    if (error) {
      console.error('❌ Error fetching receipt:', error);
      return null;
    }

    if (!receipt) {
      console.log('⚠️ No receipt found for payment:', paymentId);
      return null;
    }

    // Now get the payment details
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        amount,
        currency,
        phone_number,
        transaction_id,
        status,
        booking:bookings!inner (
          seats,
          ride:rides (
            from_city,
            to_city,
            departure_time
          )
        )
      `)
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      console.error('❌ Error fetching payment:', paymentError);
      return null;
    }

    // Transform the data to match the Receipt interface
    const transformedPayment = {
      amount: payment.amount,
      currency: payment.currency,
      phone_number: payment.phone_number,
      transaction_id: payment.transaction_id,
      status: payment.status,
      booking: {
        seats: payment.booking[0].seats,
        ride: payment.booking[0].ride[0]
      }
    };

    console.log('✅ Receipt found:', receipt.receipt_number);
    
    return {
      ...receipt,
      payment: transformedPayment
    } as Receipt;
  }

  static formatReceiptNumber(number: string): string {
    return number.toUpperCase();
  }

  static formatDateTime(date: string): string {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Generates a PDF receipt with a professional layout including:
   * - Company logo and details
   * - Receipt number and date
   * - Customer details
   * - Payment details
   * - Ride information
   * - Terms and conditions
   * - QR code for verification
   */
  static async generatePDF(receipt: Receipt): Promise<string> {
    // TODO: Implement PDF generation using PDFKit
    // For now return a placeholder URL
    return `/api/receipts/${receipt.id}/pdf`;
  }

  /**
   * Returns a formatted receipt summary for display
   */
  static getReceiptSummary(receipt: Receipt): string {
    const amount = formatCurrency(receipt.payment.amount);
    const date = this.formatDateTime(receipt.issued_at);
    return `Receipt ${receipt.receipt_number} - ${amount} - ${date}`;
  }

  /**
   * Validates a receipt number format
   */
  static isValidReceiptNumber(number: string): boolean {
    const pattern = /^RECEIPT-\d{4}-\d{5}$/;
    return pattern.test(number);
  }
}
