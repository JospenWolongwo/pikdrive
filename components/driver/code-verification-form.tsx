"use client"

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { KeyRound, Loader2, CheckCircle } from 'lucide-react'

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
      toast.error('Please enter the complete 6-character verification code')
      return
    }

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null
      }))

      const response = await fetch('/api/bookings/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          bookingId, 
          verificationCode: state.code 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify code')
      }

      if (!data.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: data.message || 'Invalid verification code',
          lastUpdated: Date.now()
        }))
        toast.error(data.message || 'Invalid verification code')
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
      toast.success('Passenger verified successfully!')
      
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500)
      }
    } catch (error) {
      console.error('🔴 Error verifying code:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to verify code',
        lastUpdated: Date.now()
      }))
      toast.error('Failed to verify passenger code')
    }
  }, [bookingId, state.code, onSuccess])

  // If already verified
  if (state.verified) {
    return (
      <Card className="bg-green-50 border border-green-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-green-800 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            Passenger Verified
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700">
            The passenger has been successfully verified. You are clear to proceed with the ride.
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
          Verify Passenger
        </CardTitle>
        <CardDescription>
          Enter the 6-character code provided by your passenger
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            id="verification-code"
            placeholder="Enter code (e.g. AB12C3)"
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
          Verify Code
        </Button>
      </CardFooter>
    </Card>
  )
}
