'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PaymentStatus } from '@/lib/payment/types';

function PaymentStatusContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const [paymentState, setPaymentState] = useState({
    status: 'loading' as 'loading' | 'success' | 'error',
    message: 'Checking payment status...',
    lastUpdated: Date.now()
  });

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const txid = searchParams.get('txid');
        if (!txid) {
          setPaymentState(prev => ({
            ...prev,
            status: 'error',
            message: 'No transaction ID found',
            lastUpdated: Date.now()
          }));
          return;
        }

        // Check payment status every 3 seconds until it's final
        const interval = setInterval(async () => {
          console.log('🔄 Checking payment status for:', txid);
          const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('transaction_id', txid)
            .single();

          if (error) {
            console.error('❌ Error fetching payment:', error);
            setPaymentState(prev => ({
              ...prev,
              status: 'error',
              message: 'Error checking payment status',
              lastUpdated: Date.now()
            }));
            clearInterval(interval);
            return;
          }

          if (payment) {
            console.log('📦 Payment status:', payment.status);
            if (payment.status === 'completed') {
              setPaymentState(prev => ({
                ...prev,
                status: 'success',
                message: 'Payment successful! Redirecting...',
                lastUpdated: Date.now()
              }));
              clearInterval(interval);
              // Redirect to booking page after 3 seconds
              setTimeout(() => {
                window.location.href = `/bookings/${payment.booking_id}`;
              }, 3000);
            } else if (payment.status === 'failed') {
              setPaymentState(prev => ({
                ...prev,
                status: 'error',
                message: 'Payment failed. Please try again.',
                lastUpdated: Date.now()
              }));
              clearInterval(interval);
            }
          }
        }, 3000);

        // Clean up interval on unmount
        return () => clearInterval(interval);
      } catch (error) {
        console.error('❌ Error in payment status check:', error);
        setPaymentState(prev => ({
          ...prev,
          status: 'error',
          message: 'Error checking payment status',
          lastUpdated: Date.now()
        }));
      }
    };

    checkPaymentStatus();
  }, [searchParams, supabase]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <div className="text-center">
          {paymentState.status === 'loading' && (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          )}
          {paymentState.status === 'success' && (
            <div className="text-green-500 text-5xl mb-4">✓</div>
          )}
          {paymentState.status === 'error' && (
            <div className="text-red-500 text-5xl mb-4">×</div>
          )}
          <h2 className="text-2xl font-semibold mb-2">
            {paymentState.status === 'loading' ? 'Processing Payment' : 'Payment Status'}
          </h2>
          <p className="text-gray-600">{paymentState.message}</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    }>
      <PaymentStatusContent />
    </Suspense>
  );
}
