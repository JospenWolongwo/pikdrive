'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { BookingCard } from "./booking-card"
import { ReceiptService } from "@/lib/payment/receipt-service"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"

interface Driver {
  full_name: string;
  avatar_url: string;
}

interface DatabaseDriver {
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
  driver: {
    full_name: string;
    avatar_url?: string;
  }[];
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

interface DatabaseRide {
  id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  car_model: string;
  car_color: string;
  price: number;
  driver: DatabaseDriver[];
}

interface DatabaseBooking {
  id: string;
  seats: number;
  status: string;
  payment_status: string;
  created_at: string;
  ride: DatabaseRide;
  payments?: Payment[];
}

interface BookingCardRide extends Omit<DatabaseRide, 'driver'> {
  driver: Driver;
}

interface BookingCardBooking extends Omit<DatabaseBooking, 'ride'> {
  ride: BookingCardRide;
}

interface BookingWithReceipt extends BookingCardBooking {
  receipt?: {
    id: string;
    payment_id: string;
    created_at: string;
  };
}

export function BookingsList({ page }: { page: number }) {
  const [bookings, setBookings] = useState<BookingWithReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClientComponentClient()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true)
        
        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) throw userError
        
        if (!user) {
          router.push('/auth')
          return
        }

        // Get user's bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            seats,
            status,
            payment_status,
            created_at,
            ride:rides (
              id,
              from_city,
              to_city,
              departure_time,
              car_model,
              car_color,
              price,
              driver:profiles (
                full_name,
                avatar_url
              )
            ),
            payments (
              id,
              amount,
              currency,
              phone_number,
              transaction_id,
              payment_time,
              metadata,
              status
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range((page - 1) * 10, page * 10 - 1)

        if (bookingsError) throw bookingsError

        const bookingsWithReceipts = await Promise.all(
          (bookingsData || []).map(async (bookingData) => {
            const ride = Array.isArray(bookingData.ride) ? bookingData.ride[0] : bookingData.ride;
            const driver = Array.isArray(ride.driver) ? ride.driver[0] : ride.driver;

            // First create the DatabaseBooking
            const transformedBooking: DatabaseBooking = {
              id: bookingData.id,
              seats: bookingData.seats,
              status: bookingData.status,
              payment_status: bookingData.payment_status,
              created_at: bookingData.created_at,
              ride: {
                ...ride,
                driver: [driver]
              },
              payments: bookingData.payments
            };

            const payments = transformedBooking.payments || [];
            const payment = payments.length > 0 ? payments[0] : undefined;
            const isCompleted = payment?.payment_time && payment?.metadata?.financialTransactionId;

            // Then transform it to match the BookingCard's expected type
            const bookingForCard: BookingCardBooking = {
              ...transformedBooking,
              ride: {
                ...transformedBooking.ride,
                driver: {
                  full_name: transformedBooking.ride.driver[0].full_name,
                  avatar_url: transformedBooking.ride.driver[0].avatar_url || ''  // Provide empty string as fallback
                }
              }
            };

            if (isCompleted) {
              const { data: receipt } = await supabase
                .from('receipts')
                .select('*')
                .eq('payment_id', payment.id)
                .single();

              if (receipt) {
                return {
                  ...bookingForCard,
                  receipt
                };
              }
            }

            return bookingForCard;
          })
        );

        setBookings(bookingsWithReceipts || []);
      } catch (err) {
        console.error('❌ Error loading bookings:', err)
        setError(err as Error)
        toast({
          variant: "destructive",
          title: "Error loading bookings",
          description: "Please try again later."
        })
      } finally {
        setLoading(false)
      }
    }

    loadBookings()
  }, [page, supabase, router, toast])

  if (loading) {
    return <div className="text-center py-8">Loading your bookings...</div>
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <h3 className="font-semibold mb-2">Error loading bookings</h3>
        <p className="text-sm text-muted-foreground">Please try again later</p>
      </div>
    )
  }

  if (!bookings.length) {
    return (
      <div className="text-center py-8">
        <h3 className="font-semibold mb-2">No bookings found</h3>
        <p className="text-sm text-muted-foreground">
          You haven't made any bookings yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {bookings.filter(booking => booking.ride).map(booking => {
          // Only include bookings that have a ride
          const bookingWithRequiredRide = {
            ...booking,
            ride: booking.ride!, // We know ride exists because of the filter
          };
          return (
            <BookingCard 
              key={booking.id} 
              booking={bookingWithRequiredRide}
            />
          );
        })}
      </div>

      {/* Pagination */}
      {bookings.length > 0 && (
        <Pagination className="justify-center">
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`/bookings?page=${page - 1}`} />
              </PaginationItem>
            )}
            
            {[...Array(Math.ceil(bookings.length / 10))].map((_, i) => (
              <PaginationItem key={i + 1}>
                <PaginationLink
                  href={`/bookings?page=${i + 1}`}
                  isActive={page === i + 1}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}

            {page < Math.ceil(bookings.length / 10) && (
              <PaginationItem>
                <PaginationNext href={`/bookings?page=${page + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
