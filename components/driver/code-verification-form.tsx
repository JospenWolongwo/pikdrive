"use client"

import { useState, useCallback } from 'react'
import { Button, Input, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui'
import { toast } from 'sonner'
import { KeyRound, Loader2, CheckCircle } from 'lucide-react'
import { useLocale } from '@/hooks'
import { bookingApiClient } from '@/lib/api-client/booking'

interface CodeVerificationFormProps {
  bookingId: string
  onSuccess?: () => void
}

interface VerificationState {
  code: string
  loading: boolean
  verified: boolean
  error: string | null
  lastUpdated: number
}

export function CodeVerificationForm({ bookingId, onSuccess }: CodeVerificationFormProps) {
  const { t } = useLocale();
  const [state, setState] = useState<VerificationState>({
    code: '',
    loading: false,
    verified: false,
    error: null,
    lastUpdated: 0
  })

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    // Only allow letters and numbers, max 6 characters
    if (/^[A-Z0-9]*$/.test(value) && value.length <= 6) {
      setState(prev => ({ ...prev, code: value }))
    }
  }

  const verifyCode = useCallback(async () => {
    // Validate code length
    if (state.code.length !== 6) {
      toast.error(t("pages.driver.codeVerification.enterCode"))
      return
    }

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null
      }))

      const data = await bookingApiClient.verifyBookingCode(bookingId, state.code)

      if (!data.success) {
        const message = data.message || t("pages.driver.codeVerification.invalidCode")
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
          lastUpdated: Date.now()
        }))
        toast.error(message)
        return
      }

      // Success
      setState(prev => ({
        ...prev,
        loading: false,
        verified: true,
        lastUpdated: Date.now()  // Using timestamp pattern for state updates as per best practices
      }))
      
      console.log('🟢 Verification successful for booking:', bookingId)
      toast.success(t("common.success"))
      
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500)
      }
    } catch (error) {
      console.error('🔴 Error verifying code:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : t("pages.driver.codeVerification.failedToVerify"),
        lastUpdated: Date.now()
      }))
      toast.error(t("pages.driver.codeVerification.failedToVerify"))
    }
  }, [bookingId, state.code, onSuccess, t])

  // If already verified
  if (state.verified) {
    return (
      <Card className="bg-green-50 border border-green-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-green-800 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            {t("pages.driver.codeVerification.passengerVerified")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700">
            {t("pages.driver.codeVerification.passengerVerifiedDescription")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <KeyRound className="mr-2 h-5 w-5 text-primary" />
          {t("pages.driver.codeVerification.verifyPassenger")}
        </CardTitle>
        <CardDescription>
          {t("pages.driver.codeVerification.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            id="verification-code"
            placeholder={t("pages.driver.codeVerification.placeholder")}
            value={state.code}
            onChange={handleCodeChange}
            className="text-center tracking-wider font-mono text-lg uppercase"
            autoComplete="off"
            maxLength={6}
            disabled={state.loading}
          />
          
          {state.error && (
            <div className="text-sm text-red-600 text-center">
              {state.error}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button 
          onClick={verifyCode} 
          disabled={state.loading || state.code.length !== 6}
          className="w-full"
        >
          {state.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("pages.driver.codeVerification.verifyCode")}
        </Button>
      </CardFooter>
    </Card>
  )
}
