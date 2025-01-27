'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { motion } from 'framer-motion'
import { Phone, ArrowRight, Lock } from 'lucide-react'

export default function AuthPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const { signIn, verifyOTP } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const handleContinue = async () => {
    if (!phone) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your phone number",
      })
      return
    }

    setIsLoading(true)
    try {
      const formattedPhone = phone.startsWith('+') 
        ? phone 
        : `+237${phone.replace(/^237/, '')}`

      const { error } = await signIn(formattedPhone)

      if (error) throw new Error(error)

      setShowVerification(true)
      toast({
        title: "Code sent!",
        description: "Please check your phone for the verification code",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter the verification code",
      })
      return
    }

    setIsLoading(true)
    try {
      const formattedPhone = phone.startsWith('+') 
        ? phone 
        : `+237${phone.replace(/^237/, '')}`

      const { error, data } = await verifyOTP(formattedPhone, code)

      if (error) throw new Error(error)

      if (!data?.user) {
        throw new Error('Verification successful but no user returned')
      }

      toast({
        title: "Welcome!",
        description: "You've successfully signed in",
      })

      router.push('/')
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">
              {showVerification 
                ? "Enter the code we sent to your phone"
                : "Sign in with your phone number"
              }
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: showVerification ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {!showVerification ? (
              <div className="space-y-6">
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="Phone number (e.g., 698805890)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleContinue}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ⟳
                    </motion.div>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Enter verification code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isLoading}
                    className="pl-10"
                    maxLength={6}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleVerify}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      ⟳
                    </motion.div>
                  ) : (
                    <>
                      Verify & Sign In
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <button
                  onClick={() => setShowVerification(false)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors w-full text-center mt-4"
                >
                  ← Back to phone number
                </button>
              </div>
            )}
          </motion.div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              By continuing, you agree to our{' '}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}