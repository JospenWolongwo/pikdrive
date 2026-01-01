import { useEffect, useState } from 'react';
import { PaymentStatus } from '@/lib/payment/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentStatusCheckerProps {
  transactionId: string;
  provider: string;
  bookingId?: string; // ✅ Add bookingId for resilient fallback queries
  onPaymentComplete?: (status: PaymentStatus, message?: string) => void;
  pollingInterval?: number;
  maxAttempts?: number;
}

export function PaymentStatusChecker({
  transactionId,
  provider,
  bookingId, // ✅ Accept bookingId prop
  onPaymentComplete,
  pollingInterval = 5000, // 5 seconds
  maxAttempts = 60 // 5 minutes total
}: PaymentStatusCheckerProps) {
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [attempts, setAttempts] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [message, setMessage] = useState('Waiting for payment approval...');
  const [lastUpdated, setLastUpdated] = useState(Date.now()); // Add timestamp for forcing re-renders

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!isPolling) return;

      if (!transactionId) {
        setStatus('failed');
        setMessage('Invalid payment reference');
        setIsPolling(false);
        setLastUpdated(Date.now());
        onPaymentComplete?.('failed', 'Invalid payment reference');
        return;
      }

      try {
        // Use our server API endpoint as a proxy to avoid CORS issues
        // This follows the best practice of making API calls through our backend
        const response = await fetch('/api/payments/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            transactionId, 
            provider,
            bookingId // ✅ Pass bookingId for resilient fallback queries
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Server responded with ${response.status}`);
        }

        const responseData = await response.json();
        
        // Extract status and message from the nested data structure
        const paymentStatus = responseData.data?.status;
        const paymentMessage = responseData.data?.message;
        
        // Use functional updates to ensure state consistency
        setStatus((prev: PaymentStatus) => paymentStatus !== prev ? paymentStatus : prev);
        setLastUpdated(Date.now());
        
        if (paymentStatus === 'completed') {
          setIsPolling(false);
          setMessage('Payment completed successfully!');
          toast.success(paymentMessage || 'Payment completed successfully!');
          onPaymentComplete?.(paymentStatus, paymentMessage);
          return;
        }

        if (paymentStatus === 'failed') {
          setIsPolling(false);
          setMessage(paymentMessage || 'Payment failed');
          toast.error(paymentMessage || 'Payment failed');
          onPaymentComplete?.(paymentStatus, paymentMessage);
          return;
        }

        if (paymentStatus === 'processing') {
          setMessage('Processing payment...');
        }

        // Continue polling if still pending or processing
        if ((paymentStatus === 'pending' || paymentStatus === 'processing') && isPolling) {
          if (attempts < maxAttempts) {
            setAttempts(prev => prev + 1);
            timeoutId = setTimeout(checkStatus, pollingInterval);
          } else {
            setIsPolling(false);
            setMessage('Payment verification timed out');
            toast.error('Payment verification timed out. Please contact support.');
            onPaymentComplete?.('failed', 'Payment verification timed out. Please contact support.');
          }
        }
      } catch (error) {
        // Check if this is a CORS error and handle accordingly
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isCorsError = errorMessage.includes('CORS') || errorMessage.includes('NetworkError');
        
        if (isCorsError && attempts < 3) {
          // For CORS errors, try a few more times with longer delays
          setAttempts(prev => prev + 1);
          const backoffTime = pollingInterval * Math.pow(2, attempts); // Exponential backoff
          timeoutId = setTimeout(checkStatus, backoffTime);
          return;
        }
        
        // Handle complete failure
        if (attempts < maxAttempts - 1) {
          // Keep trying for a while, with increasing delays
          const backoffTime = pollingInterval * Math.pow(1.5, attempts); // Slower backoff
          setAttempts(prev => prev + 1);
          timeoutId = setTimeout(checkStatus, backoffTime);
        } else {
          setIsPolling(false);
          setMessage('Failed to verify payment status');
          setLastUpdated(Date.now());
          toast.error('Failed to verify payment status. Please contact support.');
          onPaymentComplete?.('failed', 'Failed to verify payment status. Please contact support.');
        }
      }
    };

    // Start polling
    checkStatus();

    return () => {
      setIsPolling(false);
      clearTimeout(timeoutId);
    };
  }, [transactionId, provider, bookingId, maxAttempts, pollingInterval, onPaymentComplete, isPolling, attempts, status]);

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
