"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Users, Clock, Car, ArrowRight, Loader2, Check } from "lucide-react"
import { PaymentMethodSelector } from "@/components/payment/payment-method-selector"
import { PhoneNumberInput } from "@/components/payment/phone-number-input"
import { PaymentService } from "@/lib/payment/payment-service"
import { PaymentStatus, PaymentProviderType } from "@/lib/payment/types"
import { useSupabase } from "@/providers/SupabaseProvider"
import { toast } from "sonner"
import { format } from "date-fns"
import { PaymentStatusChecker } from '@/components/payment/payment-status-checker';
import { useRouter } from 'next/navigation';

interface Ride {
  id: string
  from_city: string
  to_city: string
  price: number
  departure_time: string
  estimated_duration: string
  seats_available: number
  car_model?: string
  car_color?: string
  driver?: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  ride: Ride | null
  onBookingComplete?: () => void
}

export function BookingModal({ isOpen, onClose, ride, onBookingComplete }: BookingModalProps) {
  const { supabase, user } = useSupabase()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [seats, setSeats] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderType>()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isPhoneValid, setIsPhoneValid] = useState(false)
  const [paymentService] = useState(() => new PaymentService(supabase))
  const [bookingId, setBookingId] = useState<string>()
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'SUCCESSFUL' | 'FAILED' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);

  if (!ride) return null

  const totalPrice = seats * ride.price
  const providers = paymentService.getAvailableProviders()

  const handleCreateBooking = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            ride_id: ride.id,
            user_id: user.id,
            seats: seats,
            status: 'pending',
            payment_status: 'pending'
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Booking creation failed:', error)
        toast.error(error.message || "Failed to create booking")
        return
      }
      
      setBookingId(data.id)
      setStep(2)
    } catch (error) {
      console.error('Booking creation failed:', error)
      toast.error(error instanceof Error ? error.message : "Failed to create booking")
    }
  }

  const checkPaymentStatus = async (transactionId: string) => {
    if (!selectedProvider) return;

    try {
      const response = await fetch(`/api/payments/status?transactionId=${transactionId}&provider=${selectedProvider}`);
      if (!response.ok) throw new Error('Failed to check payment status');
      
      const data = await response.json();
      
      if (data.status === 'SUCCESSFUL') {
        setPaymentStatus('SUCCESSFUL');
        setStatusMessage('Payment completed successfully!');
        setIsPolling(false);
        
        // Show success message briefly before redirecting
        setTimeout(() => {
          setStep(3);
          if (onBookingComplete) {
            onBookingComplete();
          }
          // Close modal and redirect after showing success message
          setTimeout(() => {
            onClose();
            router.replace('/bookings');
          }, 1500);
        }, 2000);
      } else if (data.status === 'FAILED') {
        setPaymentStatus('FAILED');
        setStatusMessage(data.message || 'Payment failed. Please try again.');
        setIsPolling(false);
      } else {
        setPaymentStatus('PENDING');
        setStatusMessage('Waiting for payment approval...');
        setTimeout(() => checkPaymentStatus(transactionId), 5000);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setStatusMessage('Error checking payment status');
      setIsPolling(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedProvider || !isPhoneValid || !bookingId) {
      toast.error("Please select a payment method and enter a valid phone number");
      return;
    }

    try {
      setLoading(true);

      const paymentRequest = {
        bookingId: bookingId,
        amount: totalPrice,
        provider: selectedProvider.toLowerCase() as 'mtn' | 'orange',
        phoneNumber: phoneNumber
      };

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment failed');
      }

      if (data.success && data.transactionId) {
        setPaymentTransactionId(data.transactionId);
        toast.success('Payment request sent. Check your phone to approve.');
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  const handlePaymentComplete = async (status: PaymentStatus) => {
    if (status === 'completed') {
      setStep(3)
      if (onBookingComplete) {
        onBookingComplete()
      }
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1: // Seat selection
        return (
          <>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{ride.from_city}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{ride.to_city}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {format(new Date(ride.departure_time), "PPp")}
                    </div>
                    <div className="flex items-center">
                      <Car className="mr-1 h-4 w-4" />
                      {ride.estimated_duration}h
                    </div>
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {ride.seats_available} seats available
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats">Number of Seats</Label>
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  max={ride.seats_available}
                  value={seats}
                  onChange={(e) => setSeats(parseInt(e.target.value))}
                />
              </div>

              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total Price:</span>
                <span className="text-primary">{totalPrice.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button onClick={onClose} variant="outline">Cancel</Button>
              <Button 
                onClick={handleCreateBooking} 
                disabled={seats < 1 || seats > ride.seats_available}
              >
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )

      case 2: // Payment
        return (
          <>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">Select Payment Method</h3>
                <PaymentMethodSelector
                  providers={providers}
                  selectedProvider={selectedProvider}
                  onSelect={setSelectedProvider}
                  disabled={loading || paymentTransactionId !== null}
                />
              </div>

              <PhoneNumberInput
                value={phoneNumber}
                onChange={setPhoneNumber}
                onValidityChange={setIsPhoneValid}
                provider={selectedProvider?.toLowerCase() as 'mtn' | 'orange'}
                disabled={loading || paymentTransactionId !== null}
              />

              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Amount to Pay:</span>
                <span className="text-primary">{totalPrice.toLocaleString()} FCFA</span>
              </div>

              {paymentTransactionId ? (
                <PaymentStatusChecker
                  transactionId={paymentTransactionId}
                  provider={selectedProvider!}
                  onPaymentComplete={(status) => {
                    if (status === 'completed') {
                      // Show success message briefly before redirecting
                      setTimeout(() => {
                        setStep(3);
                        if (onBookingComplete) {
                          onBookingComplete();
                        }
                        // Close modal and redirect after showing success message
                        setTimeout(() => {
                          onClose();
                          router.replace('/bookings');
                        }, 1500);
                      }, 1000);
                    }
                  }}
                />
              ) : loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Initiating payment...</span>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button 
                onClick={() => {
                  if (!paymentTransactionId) {
                    setStep(1);
                  }
                }} 
                variant="outline"
                disabled={loading || paymentTransactionId !== null}
              >
                Back
              </Button>
              <Button
                onClick={handlePayment}
                disabled={loading || paymentTransactionId !== null || !selectedProvider || !isPhoneValid}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : paymentTransactionId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Waiting...
                  </>
                ) : (
                  'Pay Now'
                )}
              </Button>
            </div>
          </>
        )

      case 3: // Success
        return (
          <>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold">Booking Successful!</h3>
              <p className="text-muted-foreground">
                Your booking has been confirmed. You will receive a confirmation message shortly.
              </p>
              <div className="mt-6">
                <Button onClick={onClose} className="w-full">Done</Button>
              </div>
            </div>
          </>
        )
    }
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        // Only allow closing if we're not in the middle of a payment
        if (!open && !isPolling && !loading) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Book Your Ride" : 
             step === 2 ? "Payment Details" :
             "Booking Confirmation"}
          </DialogTitle>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  )
}