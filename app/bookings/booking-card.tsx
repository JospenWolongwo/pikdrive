import { formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { Receipt } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"

interface BookingCardProps {
  booking: {
    id: string
    seats: number
    status: string
    payment_status: string
    created_at: string
    ride: {
      id: string
      from_city: string
      to_city: string
      departure_time: string
      car_model: string
      car_color: string
      driver: {
        full_name: string
        avatar_url: string
      }
    }
    payments?: {
      id: string
      amount: number
      currency: string
      phone_number: string
      transaction_id: string
      payment_time: string | null
      metadata: {
        financialTransactionId?: string
      }
      status: string // Derived field
    } | null
    receipt?: {
      id: string
      payment_id: string
      created_at: string
    } | null
  }
}

export function BookingCard({ booking }: BookingCardProps) {
  console.log('🎫 BookingCard props:', {
    bookingId: booking.id,
    paymentStatus: booking.payments?.status,
    receipt: booking.receipt
  });

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 space-y-4">
          {/* Ride Details */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {booking.ride.from_city} → {booking.ride.to_city}
              </h3>
              <p className="text-sm text-muted-foreground">
                {format(new Date(booking.ride.departure_time), "PPP 'at' p")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {formatCurrency(booking.payments?.amount || 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                {booking.seats} {booking.seats === 1 ? 'seat' : 'seats'}
              </p>
            </div>
          </div>

          {/* Driver Details */}
          <div className="flex items-center gap-3">
            <Avatar>
              <img 
                src={booking.ride.driver.avatar_url || '/placeholder-avatar.png'} 
                alt={booking.ride.driver.full_name}
                className="h-10 w-10 rounded-full object-cover"
              />
            </Avatar>
            <div>
              <p className="font-medium">{booking.ride.driver.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {booking.ride.car_model} • {booking.ride.car_color}
              </p>
            </div>
          </div>

          {/* Payment Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${
                booking.payments?.status === 'completed' ? 'bg-green-500' :
                booking.payments?.status === 'failed' ? 'bg-red-500' :
                'bg-yellow-500'
              }`} />
              <span className="text-sm capitalize">
                {booking.payments?.status === 'completed' ? 'Paid' :
                 booking.payments?.status === 'failed' ? 'Payment Failed' :
                 'Payment Pending'}
              </span>
            </div>
            {booking.payments?.status === 'completed' && (
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                asChild
              >
                <Link href={`/receipts/${booking.receipt?.id}`}>
                  <Receipt className="h-4 w-4" />
                  View Receipt
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
