// Booking verification code display component
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { useSupabase } from '@/providers/SupabaseProvider'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCcw, Copy, CheckCircle, Clock } from 'lucide-react'

interface VerificationCodeDisplayProps {
  bookingId: string
}

interface VerificationState {
  code: string | null
  loading: boolean
  error: string | null
  regenerating: boolean
  copied: boolean
  lastUpdated: number
}

export function VerificationCodeDisplay({ bookingId }: VerificationCodeDisplayProps) {
  const { supabase } = useSupabase()
  const [state, setState] = useState<VerificationState>({
    code: null,
    loading: true,
    error: null,
    regenerating: false,
    copied: false,
    lastUpdated: 0
  })

  // Simplified version with memory optimizations
  const fetchVerificationCode = useCallback(async (forceRefresh = false) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      regenerating: forceRefresh,
      lastUpdated: Date.now()
    }));
    
    try {
      console.log(`🔄 Fetching verification code for booking: ${bookingId}`);
      
      // Use a more memory-efficient approach with sequential operations
      let verificationCode = null;
      
      // Only try to generate a new code if explicitly requested
      if (forceRefresh) {
        try {
          // Try main API endpoint
          const response = await fetch('/api/bookings/generate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
          });
          
          if (response.ok) {
            const data = await response.json();
            verificationCode = data.verificationCode;
          }
        } catch (error) {
          console.error('Error generating code:', error);
        }
      } else {
        // First try to get existing code (most efficient)
        try {
          const { data, error } = await supabase
            .from('bookings')
            .select('verification_code, code_expiry')
            .eq('id', bookingId)
            .single();
            
          if (data?.verification_code) {
            verificationCode = data.verification_code;
          }
        } catch (error) {
          console.error('Error fetching from DB:', error);
        }
      }
      
      // If we still don't have a code, try the backup endpoint
      if (!verificationCode) {
        try {
          const backupResponse = await fetch('/api/bookings/code-generator', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
          });
          
          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            verificationCode = backupData.verificationCode;
          }
        } catch (error) {
          console.error('Error with backup endpoint:', error);
        }
      }

      if (verificationCode) {
        setState(prev => ({ 
          ...prev, 
          code: verificationCode, 
          loading: false, 
          regenerating: false,
          error: null,
          lastUpdated: Date.now()
        }));
      } else {
        throw new Error('Failed to retrieve verification code');
      }
    } catch (error) {
      console.error('Error fetching verification code:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to load verification code',
        loading: false,
        regenerating: false,
        lastUpdated: Date.now()
      }));
    }
  }, [bookingId, supabase]);

  // Copy code to clipboard
  const copyToClipboard = useCallback(() => {
    if (state.code) {
      navigator.clipboard.writeText(state.code)
      setState(prev => ({ ...prev, copied: true }))
      toast.success('Verification code copied to clipboard')
      
      // Reset copied state after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, copied: false }))
      }, 3000)
    }
  }, [state.code, toast])

  // Initial load effect
  useEffect(() => {
    fetchVerificationCode()
    
    // Set up real-time subscription for code verification
    const subscription = supabase
      .channel(`booking-${bookingId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'bookings',
        filter: `id=eq.${bookingId}` 
      }, (payload: { 
        new: { 
          id: string; 
          verification_code?: string;
          code_expiry?: string;
          [key: string]: any; 
        }; 
        old: any; 
      }) => {
        console.log('🔄 Booking updated via subscription:', payload);
        
        // Check if verification code has been updated
        if (payload.new && 
            (payload.new.verification_code !== payload.old?.verification_code ||
             payload.new.status !== payload.old?.status ||
             payload.new.payment_status !== payload.old?.payment_status)) {
          
          console.log('📋 Verification code or status changed, refreshing...');
          fetchVerificationCode();
        }
      })
      .subscribe();
      
    // Poll for verification code every 10 seconds as backup
    // This ensures we get the code even if the subscription fails
    const pollingInterval = setInterval(() => {
      if (!state.code && !state.error) {
        console.log('⏱️ Polling for verification code...');
        fetchVerificationCode();
      }
    }, 10000); // 10 seconds polling interval
    
    return () => {
      subscription.unsubscribe();
      clearInterval(pollingInterval);
    }
  }, [bookingId, fetchVerificationCode, supabase, state.code, state.error]);

  if (state.loading && !state.regenerating) {
    return (
      <Card className="bg-muted/50 border shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // If code is verified
  if (!state.code && !state.loading && !state.error) {
    return (
      <Card className="bg-green-50 border border-green-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-lg font-medium text-green-800">Verification Complete</h3>
            <p className="text-sm text-green-600">
              Your ride has been verified by the driver
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If there's an error
  if (state.error) {
    return (
      <Card className="bg-red-50 border border-red-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium text-red-800">Error Loading Verification Code</h3>
            <p className="text-sm text-red-600">{state.error}</p>
            <div className="mt-4 text-center space-y-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchVerificationCode(true)}
                disabled={state.regenerating}
                className="bg-red-50 hover:bg-red-100 text-red-800"
              >
                {state.regenerating && <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />}
                Try Again
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  try {
                    setState(prev => ({ ...prev, loading: true, error: null }));
                    // Direct database call as ultimate fallback
                    const { data, error: rpcError } = await supabase.rpc(
                      'generate_booking_verification_code', 
                      { booking_id: bookingId }
                    );
                    
                    if (rpcError) throw rpcError;
                    setState(prev => ({ ...prev, code: data, loading: false }));
                  } catch (err) {
                    console.error('Direct RPC fallback failed:', err);
                    setState(prev => ({ ...prev, error: 'Could not generate code. Please try later.', loading: false }));
                  }
                }}
                className="ml-2 bg-blue-50 hover:bg-blue-100 text-blue-800"
              >
                Use Direct Method
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show the verification code
  return (
    <Card className="bg-primary-50 border border-primary-200 shadow-sm">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Verification Code</h3>
            <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-4 rounded-md shadow-md">
              <div className="flex justify-center">
                <span className="font-mono text-2xl font-bold tracking-wider">
                  {state.code ? state.code.split('').join(' ') : 'Loading...'}
                </span>
              </div>
              <div className="mt-3 text-xs text-blue-100 text-center">
                Valid for 24 hours
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Show this code to your driver to verify your booking
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchVerificationCode(true)}
              disabled={state.regenerating}
              className="w-full mt-2"
            >
              {state.regenerating && <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />}
              Refresh Code
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
