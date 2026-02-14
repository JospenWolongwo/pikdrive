"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button, Card, CardContent, Skeleton } from '@/components/ui'
import { toast } from 'sonner'
import { useSupabase } from '@/providers/SupabaseProvider'
import { RefreshCcw, Copy, CheckCircle, Clock } from 'lucide-react'
import { useLocale } from '@/hooks'
import { bookingApiClient } from '@/lib/api-client'

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
  const { t } = useLocale()
  const [state, setState] = useState<VerificationState>({
    code: null,
    loading: true,
    error: null,
    regenerating: false,
    copied: false,
    lastUpdated: 0
  })

  const fetchVerificationCode = useCallback(async (forceRefresh = false) => {
    setState(prev => ({ 
      ...prev, 
      loading: true, 
      regenerating: forceRefresh,
      lastUpdated: Date.now()
    }));
    
    try {
      let verificationCode: string | null = null;
      let isVerified = false;
      
      if (forceRefresh) {
        try {
          const data = await bookingApiClient.refreshVerificationCode(bookingId);
          verificationCode = data?.verificationCode ?? null;
        } catch (error) {
          console.error('Error generating code:', error);
        }
      } else {
        try {
          const response = await bookingApiClient.getVerificationCode(bookingId);
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch verification code');
          }

          isVerified = Boolean(response.codeVerified);

          if (!isVerified && response.verificationCode) {
            verificationCode = response.verificationCode;
          }
        } catch (error) {
          console.error('Error fetching verification code:', error);
        }
      }

      if (!verificationCode && !isVerified) {
        try {
          const backupData = await bookingApiClient.generateVerificationCodeBackup(bookingId);
          verificationCode = backupData?.verificationCode ?? null;
        } catch (error) {
          console.error('Error with backup endpoint:', error);
        }
      }

      if (isVerified) {
        setState(prev => ({ 
          ...prev, 
          code: null, 
          loading: false, 
          regenerating: false,
          error: null,
          lastUpdated: Date.now()
        }));
        return;
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
        error: error instanceof Error ? error.message : t("pages.bookings.verificationCode.errors.failedToLoad"),
        loading: false,
        regenerating: false,
        lastUpdated: Date.now()
      }));
    }
  }, [bookingId, supabase, t]);

  const copyToClipboard = useCallback(() => {
    if (state.code) {
      navigator.clipboard.writeText(state.code)
      setState(prev => ({ ...prev, copied: true }))
      toast.success(t("pages.bookings.verificationCode.copiedToClipboard"))

      setTimeout(() => {
        setState(prev => ({ ...prev, copied: false }))
      }, 3000)
    }
  }, [state.code, toast])

  useEffect(() => {
    fetchVerificationCode()

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
          code_verified?: boolean;
          [key: string]: any; 
        }; 
        old: any; 
      }) => {
        if (payload.new && 
            payload.new.code_verified === true &&
            payload.old?.code_verified !== true) {
          setState(prev => ({
            ...prev,
            code: '',
            loading: false,
            error: null,
            lastUpdated: Date.now()
          }));
          return;
        }

        if (payload.new && 
            (payload.new.verification_code !== payload.old?.verification_code ||
             payload.new.status !== payload.old?.status ||
             payload.new.payment_status !== payload.old?.payment_status)) {
          fetchVerificationCode();
        }
      })
      .subscribe();

    // Backup if subscription fails
    const pollingInterval = setInterval(() => {
      if (!state.code && !state.error) {
        fetchVerificationCode();
      }
    }, 10000);

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

  if (!state.code && !state.loading && !state.error) {
    return (
      <Card className="bg-green-50 border border-green-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <h3 className="text-lg font-medium text-green-800">{t("pages.bookings.verificationCode.verified.title")}</h3>
            <p className="text-sm text-green-600">
              {t("pages.bookings.verificationCode.verified.description")}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (state.error) {
    return (
      <Card className="bg-red-50 border border-red-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium text-red-800">{t("pages.bookings.verificationCode.errors.title")}</h3>
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
                {t("pages.bookings.verificationCode.errors.retry")}
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
                    setState(prev => ({ ...prev, error: t("pages.bookings.verificationCode.errors.failedToGenerate"), loading: false }));
                  }
                }}
                className="ml-2 bg-blue-50 hover:bg-blue-100 text-blue-800"
              >
                {t("pages.bookings.verificationCode.errors.useDirectMethod")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-primary-50 border border-primary-200 shadow-sm">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{t("pages.bookings.verificationCode.title")}</h3>
            <p className="text-sm text-foreground px-2">
              {t("pages.bookings.verificationCode.description")}
            </p>
            <div className="bg-gradient-to-r from-blue-800 to-blue-600 text-white p-4 rounded-md shadow-md">
              <div className="flex justify-center">
                <span className="font-mono text-2xl font-bold tracking-wider">
                  {state.code ? state.code.split('').join(' ') : t("pages.bookings.verificationCode.loading")}
                </span>
              </div>
              <div className="mt-3 text-xs text-blue-100 text-center">
                {t("pages.bookings.verificationCode.validFor")}
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              {t("pages.bookings.verificationCode.showToDriver")}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchVerificationCode(true)}
              disabled={state.regenerating}
              className="w-full mt-2"
            >
              {state.regenerating && <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />}
              {t("pages.bookings.verificationCode.refreshCode")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
