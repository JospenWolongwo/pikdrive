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
      toast.error('Veuillez entrer le code de vérification complet à 6 caractères')
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
        throw new Error(data.error || 'Échec de la vérification du code')
      }

      if (!data.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: data.message || 'Code de vérification invalide',
          lastUpdated: Date.now()
        }))
        toast.error(data.message || 'Code de vérification invalide')
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
      toast.success('Passager vérifié avec succès !')
      
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500)
      }
    } catch (error) {
      console.error('🔴 Error verifying code:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Échec de la vérification du code',
        lastUpdated: Date.now()
      }))
      toast.error('Échec de la vérification du code du passager')
    }
  }, [bookingId, state.code, onSuccess])

  // If already verified
  if (state.verified) {
    return (
      <Card className="bg-green-50 border border-green-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-green-800 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" />
            Passager Vérifié
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700">
            Le passager a été vérifié avec succès. Vous pouvez procéder au trajet.
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
          Vérifier le Passager
        </CardTitle>
        <CardDescription>
          Entrez le code à 6 caractères fourni par votre passager
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Input
            id="verification-code"
            placeholder="Entrez le code (ex: AB12C3)"
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
          Vérifier le Code
        </Button>
      </CardFooter>
    </Card>
  )
}
