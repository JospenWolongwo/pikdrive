'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PaymentStatus } from '@/lib/payment/types';

export default function PaymentStatusPage() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string>('loading');
  const [message, setMessage] = useState<string>('Checking payment status...');

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const txid = searchParams.get('txid');
        if (!txid) {
          setStatus('error');
          setMessage('No transaction ID found');
          return;
        }

        // Check payment status every 3 seconds until it's final
        const interval = setInterval(async () => {
          const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('transaction_id', txid)
            .single();

          if (payment) {
            if (payment.status === 'completed') {
              setStatus('success');
              setMessage('Payment successful! Redirecting...');
              clearInterval(interval);
              // Redirect to booking page after 3 seconds
              setTimeout(() => {
                window.location.href = `/bookings/${payment.booking_id}`;
              }, 3000);
            } else if (payment.status === 'failed') {
              setStatus('error');
              setMessage('Payment failed. Please try again.');
              clearInterval(interval);
            }
          }
        }, 3000);

        // Clean up interval on unmount
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error checking payment status:', error);
        setStatus('error');
        setMessage('Error checking payment status');
      }
    };

    checkPaymentStatus();
  }, [searchParams, supabase]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="text-center">
          {status === 'loading' && (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          )}
          {status === 'success' && (
            <div className="text-green-500 text-5xl mb-4">✓</div>
          )}
          {status === 'error' && (
            <div className="text-red-500 text-5xl mb-4">×</div>
          )}
          <h2 className="text-2xl font-semibold mb-2">
            {status === 'loading' ? 'Processing Payment' : 'Payment Status'}
          </h2>
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}
