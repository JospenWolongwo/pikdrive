import { useEffect, useState } from 'react';
import { PaymentService } from '@/lib/payment/payment-service';
import { PaymentStatus } from '@/lib/payment/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface PaymentStatusCheckerProps {
  transactionId: string;
  provider: string;
  onPaymentComplete?: (status: PaymentStatus) => void;
  pollingInterval?: number;
  maxAttempts?: number;
}

export function PaymentStatusChecker({
  transactionId,
  provider,
  onPaymentComplete,
  pollingInterval = 5000, // 5 seconds
  maxAttempts = 60 // 5 minutes total
}: PaymentStatusCheckerProps) {
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [attempts, setAttempts] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [message, setMessage] = useState('Waiting for payment approval...');
  const supabase = createClientComponentClient();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const paymentService = new PaymentService(supabase);

    const checkStatus = async () => {
      if (!isPolling) return;

      try {
        const response = await paymentService.checkPaymentStatus(transactionId, provider);
        console.log(' 🔄 Payment status update:', { 
          currentStatus: status,
          newStatus: response.status,
          message: response.message 
        });
        
        // Only update if status has changed
        if (response.status !== status) {
          setStatus(response.status);
          
          if (response.status === 'completed') {
            setIsPolling(false);
            setMessage('Payment completed successfully!');
            toast.success(response.message);
            onPaymentComplete?.(response.status);
            return;
          }

          if (response.status === 'failed') {
            setIsPolling(false);
            setMessage(response.message || 'Payment failed');
            toast.error(response.message);
            onPaymentComplete?.(response.status);
            return;
          }

          if (response.status === 'processing') {
            setMessage('Processing payment...');
          }
        }

        // Continue polling if still pending or processing
        if ((response.status === 'pending' || response.status === 'processing') && isPolling) {
          if (attempts < maxAttempts) {
            setAttempts(prev => prev + 1);
            timeoutId = setTimeout(checkStatus, pollingInterval);
          } else {
            setIsPolling(false);
            setMessage('Payment verification timed out');
            toast.error('Payment verification timed out. Please contact support.');
            onPaymentComplete?.('failed');
          }
        }
      } catch (error) {
        console.error(' ❌ Error checking payment status:', error);
        setIsPolling(false);
        setMessage('Failed to verify payment status');
        toast.error('Failed to verify payment status. Please contact support.');
        onPaymentComplete?.('failed');
      }
    };

    // Start polling
    checkStatus();

    return () => {
      setIsPolling(false);
      clearTimeout(timeoutId);
    };
  }, [transactionId, provider, attempts, maxAttempts, pollingInterval, onPaymentComplete, supabase, isPolling, status]);

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-2">
      <div className="flex items-center gap-2">
        {isPolling ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : status === 'completed' ? (
          <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
        <span className={`${
          status === 'completed' ? 'text-green-600' :
          status === 'failed' ? 'text-red-600' :
          'text-gray-600'
        }`}>
          {message}
        </span>
      </div>
      {isPolling && (
        <p className="text-sm text-gray-500">
          Please check your phone for the payment request
        </p>
      )}
    </div>
  );
}
