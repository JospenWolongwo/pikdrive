'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import { VerificationCodeDisplay } from "@/components/bookings/verification-code-display"
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface Driver {
  full_name: string;
  avatar_url?: string;
}

interface Ride {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  car_model: string;
  car_color: string;
  price: number;
  driver: Driver;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  phone_number: string;
  transaction_id?: string;
  payment_time?: string;
  metadata?: {
    financialTransactionId?: string;
    [key: string]: any;
  };
  status?: string;
}

interface Booking {
  id: string;
  seats: number;
  status: string;
  payment_status: string;
  created_at: string;
  ride: Ride;
  payments?: Payment[];
  receipt?: {
    id: string;
    payment_id: string;
    created_at: string;
  };
}

interface BookingCardProps {
  booking: Booking;
}

export function BookingCard({ booking }: BookingCardProps) {
  const payment = booking.payments?.[0]
  const isCompleted = payment?.payment_time && payment?.metadata?.financialTransactionId
  const [showVerification, setShowVerification] = useState(false)
  
  // Determine if we should show verification code
  // Show for pending_verification status (new) as well as confirmed status bookings
  const shouldShowVerification = 
    (booking.status === 'pending_verification' || booking.status === 'confirmed') && 
    booking.payment_status === 'completed'

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {booking.ride.from_city} → {booking.ride.to_city}
        </CardTitle>
        <CardDescription>
          {formatDate(booking.ride.departure_time)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <div>
            <strong>Driver:</strong> {booking.ride.driver.full_name}
          </div>
          <div>
            <strong>Car:</strong> {booking.ride.car_model} ({booking.ride.car_color})
          </div>
          <div>
            <strong>Seats:</strong> {booking.seats}
          </div>
          <div>
            <strong>Total:</strong> {payment ? `${payment.amount} ${payment.currency}` : 'N/A'}
          </div>
          <div>
            <strong>Status:</strong>{' '}
            <span className={`inline-block px-2 py-1 text-sm rounded-full ${
              booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {booking.status}
            </span>
          </div>
          {payment && (
            <div>
              <strong>Payment:</strong>{' '}
              <span className={`inline-block px-2 py-1 text-sm rounded-full ${
                isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {isCompleted ? 'Completed' : 'Pending'}
              </span>
            </div>
          )}
          
          {shouldShowVerification && (
            <div className="mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full flex items-center justify-between"
                onClick={() => setShowVerification(!showVerification)}
              >
                <span>{showVerification ? 'Hide' : 'Show'} Driver Verification Code</span>
                {showVerification ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {showVerification && (
                <div className="mt-4">
                  <VerificationCodeDisplay bookingId={booking.id} />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {booking.receipt && (
          <Button variant="outline" asChild>
            <a href={`/receipts/${booking.receipt.id}`} target="_blank" rel="noopener noreferrer">
              View Receipt
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
