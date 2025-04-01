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
  const [lastUpdated, setLastUpdated] = useState(Date.now()); // Add timestamp for forcing re-renders
  const supabase = createClientComponentClient();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const paymentService = new PaymentService(supabase);

    const checkStatus = async () => {
      if (!isPolling) return;

      if (!transactionId) {
        console.error('❌ Missing transaction ID for payment status check');
        setStatus(prev => 'failed');
        setMessage(prev => 'Invalid payment reference');
        setIsPolling(prev => false);
        setLastUpdated(Date.now());
        onPaymentComplete?.('failed');
        return;
      }

      console.log('🔄 Checking payment status:', { transactionId, provider, attempt: attempts + 1 });

      try {
        // Use our server API endpoint as a proxy to avoid CORS issues
        // This follows the best practice of making API calls through our backend
        const response = await fetch('/api/payments/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactionId, provider }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();
        
        console.log('✅ Payment status update:', { 
          transactionId,
          currentStatus: status,
          newStatus: data.status,
          message: data.message,
          timestamp: new Date().toISOString()
        });
        
        // Use functional updates to ensure state consistency
        setStatus(prev => data.status !== prev ? data.status : prev);
        setLastUpdated(Date.now());
        
        if (data.status === 'completed') {
          setIsPolling(prev => false);
          setMessage(prev => 'Payment completed successfully!');
          toast.success(data.message || 'Payment completed successfully!');
          onPaymentComplete?.(data.status);
          return;
        }

        if (data.status === 'failed') {
          setIsPolling(prev => false);
          setMessage(prev => data.message || 'Payment failed');
          toast.error(data.message || 'Payment failed');
          onPaymentComplete?.(data.status);
          return;
        }

        if (data.status === 'processing') {
          setMessage(prev => 'Processing payment...');
        }

        // Continue polling if still pending or processing
        if ((data.status === 'pending' || data.status === 'processing') && isPolling) {
          if (attempts < maxAttempts) {
            setAttempts(prev => prev + 1);
            timeoutId = setTimeout(checkStatus, pollingInterval);
          } else {
            setIsPolling(prev => false);
            setMessage(prev => 'Payment verification timed out');
            toast.error('Payment verification timed out. Please contact support.');
            onPaymentComplete?.('failed');
          }
        }
      } catch (error) {
        console.error('❌ Payment status check error:', error);
        
        // Check if this is a CORS error and handle accordingly
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isCorsError = errorMessage.includes('CORS') || errorMessage.includes('NetworkError');
        
        if (isCorsError && attempts < 3) {
          // For CORS errors, try a few more times with longer delays
          console.log('⚠️ CORS error detected, retrying with exponential backoff...');
          setAttempts(prev => prev + 1);
          const backoffTime = pollingInterval * Math.pow(2, attempts); // Exponential backoff
          timeoutId = setTimeout(checkStatus, backoffTime);
          return;
        }
        
        // Use direct Supabase call as fallback if API endpoint fails
        try {
          console.log('🔄 Trying direct payment status check as fallback...');
          const fallbackResult = await paymentService.checkPaymentStatus(transactionId, provider);
          
          if (fallbackResult.success) {
            console.log('✅ Fallback payment check succeeded:', fallbackResult);
            setStatus(prev => fallbackResult.status);
            setMessage(prev => fallbackResult.message || 'Payment status updated');
            setLastUpdated(Date.now());
            
            if (fallbackResult.status === 'completed' || fallbackResult.status === 'failed') {
              setIsPolling(prev => false);
              onPaymentComplete?.(fallbackResult.status);
            } else {
              // Continue polling
              if (attempts < maxAttempts) {
                setAttempts(prev => prev + 1);
                timeoutId = setTimeout(checkStatus, pollingInterval);
              }
            }
            return;
          }
        } catch (fallbackError) {
          console.error('❌ Fallback payment check also failed:', fallbackError);
        }
        
        // Handle complete failure
        if (attempts < maxAttempts - 1) {
          // Keep trying for a while, with increasing delays
          const backoffTime = pollingInterval * Math.pow(1.5, attempts); // Slower backoff
          console.log(`⏱️ Retry #${attempts + 1} in ${backoffTime/1000}s`);
          setAttempts(prev => prev + 1);
          timeoutId = setTimeout(checkStatus, backoffTime);
        } else {
          setIsPolling(prev => false);
          setMessage(prev => 'Failed to verify payment status');
          setLastUpdated(Date.now());
          toast.error('Failed to verify payment status. Please contact support.');
          onPaymentComplete?.('failed');
        }
      }
    };

    // Start polling
    checkStatus();

    return () => {
      setIsPolling(false);
      clearTimeout(timeoutId);
    };
  }, [transactionId, provider, maxAttempts, pollingInterval, onPaymentComplete, supabase, isPolling, attempts, status]);

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
