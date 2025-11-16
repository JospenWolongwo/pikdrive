'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface PayoutStatusCheckerProps {
  transactionId: string;
  payoutId?: string;
  provider?: string;
  onStatusChange?: (status: PayoutStatus) => void;
  onComplete?: (status: PayoutStatus) => void;
}

/**
 * Exponential backoff polling intervals (in milliseconds)
 * Provider-aware: MTN has callbacks (can poll less), Orange doesn't (poll more)
 */
const getPollingInterval = (elapsedSeconds: number, provider: string): number => {
  const hasCallbacks = provider.toLowerCase() === 'mtn';
  
  if (hasCallbacks) {
    // MTN has callbacks - can poll less frequently
    if (elapsedSeconds < 30) return 3000;      // 3 seconds (slower initial)
    if (elapsedSeconds < 150) return 10000;     // 10 seconds
    if (elapsedSeconds < 270) return 20000;     // 20 seconds
    return 30000;                                // 30 seconds
  } else {
    // Orange Money - no callbacks, need more frequent polling
    if (elapsedSeconds < 30) return 2000;       // 2 seconds
    if (elapsedSeconds < 150) return 5000;      // 5 seconds
    if (elapsedSeconds < 270) return 10000;      // 10 seconds
    return 30000;                                // 30 seconds
  }
};

const MAX_POLLING_TIME = 5 * 60 * 1000; // 5 minutes

export function PayoutStatusChecker({
  transactionId,
  payoutId,
  provider = 'mtn',
  onStatusChange,
  onComplete,
}: PayoutStatusCheckerProps) {
  const [status, setStatus] = useState<PayoutStatus>('processing');
  const [isPolling, setIsPolling] = useState(true);
  const [message, setMessage] = useState('Vérification du statut du paiement...');
  const [startTime] = useState(Date.now());
  const [lastCheck, setLastCheck] = useState(Date.now());

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const checkStatus = async () => {
      if (!isPolling || !isMounted) return;

      const elapsed = Date.now() - startTime;
      
      // Stop polling after max time
      if (elapsed >= MAX_POLLING_TIME) {
        setIsPolling(false);
        setMessage('Vérification en arrière-plan...');
        toast.info('Le statut sera mis à jour automatiquement');
        return;
      }

      if (!transactionId && !payoutId) {
        console.error('❌ Missing transaction ID or payout ID for payout status check');
        setStatus('failed');
        setMessage('Référence de paiement invalide');
        setIsPolling(false);
        onComplete?.('failed');
        return;
      }

      console.log('🔄 Checking payout status:', { 
        transactionId, 
        payoutId, 
        provider, 
        elapsedSeconds: Math.floor(elapsed / 1000) 
      });

      try {
        const response = await fetch('/api/payouts/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            transactionId: transactionId || undefined,
            payoutId: payoutId || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Server responded with ${response.status}`);
        }

        const responseData = await response.json();
        
        if (!responseData.success) {
          throw new Error(responseData.error || 'Failed to check payout status');
        }

        const payoutStatus = responseData.data?.status as PayoutStatus;
        const payoutMessage = responseData.data?.message;
        const shouldRetry = responseData.data?.shouldRetry;
        
        console.log('✅ Payout status update:', { 
          transactionId,
          payoutId,
          currentStatus: status,
          newStatus: payoutStatus,
          message: payoutMessage,
          shouldRetry,
          timestamp: new Date().toISOString()
        });
        
        setLastCheck(Date.now());
        
        // Update status if changed
        if (payoutStatus && payoutStatus !== status) {
          setStatus(payoutStatus);
          onStatusChange?.(payoutStatus);
        }
        
        // Handle final statuses
        if (payoutStatus === 'completed') {
          setIsPolling(false);
          setMessage('Paiement complété avec succès!');
          toast.success(payoutMessage || 'Paiement complété avec succès!');
          onComplete?.(payoutStatus);
          return;
        }

        if (payoutStatus === 'failed') {
          setIsPolling(false);
          setMessage(shouldRetry 
            ? 'Échec temporaire - Nouvelle tentative en cours...'
            : 'Paiement échoué'
          );
          if (!shouldRetry) {
            toast.error(payoutMessage || 'Paiement échoué');
          }
          onComplete?.(payoutStatus);
          return;
        }

        // Update message based on status
        if (payoutStatus === 'processing') {
          setMessage('Traitement du paiement en cours...');
        } else if (payoutStatus === 'pending') {
          setMessage('En attente de traitement...');
        }

        // Continue polling if still pending or processing
        if ((payoutStatus === 'pending' || payoutStatus === 'processing') && isPolling && isMounted) {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const nextInterval = getPollingInterval(elapsedSeconds, provider);
          
          console.log(`⏱️ Next check in ${nextInterval / 1000}s (elapsed: ${elapsedSeconds}s, provider: ${provider})`);
          
          timeoutId = setTimeout(checkStatus, nextInterval);
        }
      } catch (error) {
        console.error('❌ Payout status check error:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Retry with exponential backoff on errors
        if (isPolling && isMounted) {
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          const baseInterval = getPollingInterval(elapsedSeconds, provider);
          const backoffTime = baseInterval * Math.pow(1.5, Math.floor(elapsedSeconds / 30)); // Exponential backoff
          
          console.log(`⏱️ Error retry in ${backoffTime / 1000}s`);
          timeoutId = setTimeout(checkStatus, backoffTime);
        } else {
          setIsPolling(false);
          setMessage('Erreur de vérification');
          toast.error('Erreur lors de la vérification du statut. Veuillez rafraîchir la page.');
        }
      }
    };

    // Start polling immediately
    checkStatus();

    return () => {
      isMounted = false;
      setIsPolling(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [transactionId, payoutId, provider, onStatusChange, onComplete, isPolling, startTime, status]);

  const getStatusIcon = () => {
    if (isPolling) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'processing':
        return 'text-blue-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-2">
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className={getStatusColor()}>
          {message}
        </span>
      </div>
      {isPolling && (
        <p className="text-sm text-gray-500">
          Vérification automatique en cours...
        </p>
      )}
    </div>
  );
}

