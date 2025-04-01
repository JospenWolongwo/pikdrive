'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { BookingCard } from "./booking-card"
import { ReceiptService } from "@/lib/payment/receipt-service"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
    receipt_number?: string;
    issued_at?: string;
    pdf_url?: string;
  };
}

export function BookingsList({ page }: { page: number }) {
  const [bookings, setBookings] = useState<BookingWithReceipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [totalBookings, setTotalBookings] = useState(0)
  const itemsPerPage = 10
  const supabase = createClientComponentClient()
  const router = useRouter()
  const { toast } = useToast()

  // Create filtered bookings based on search query
  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    
    const query = searchQuery.toLowerCase().trim();
    return bookings.filter(booking => {
      // Skip bookings without required data
      if (!booking.ride) return false;
      
      // Search across multiple fields
      return (
        booking.ride.from_city.toLowerCase().includes(query) ||
        booking.ride.to_city.toLowerCase().includes(query) ||
        booking.status.toLowerCase().includes(query) ||
        booking.payment_status?.toLowerCase().includes(query) ||
        booking.ride.driver.full_name.toLowerCase().includes(query)
      );
    });
  }, [bookings, searchQuery]);

  // Count total pages based on filtered results
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / itemsPerPage));
  
  // Get current page items
  const currentPageBookings = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredBookings.length);
    return filteredBookings.slice(startIndex, endIndex);
  }, [filteredBookings, page, itemsPerPage]);

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

        // Get total count first for true pagination
        const { count, error: countError } = await supabase
          .from('bookings')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          
        if (countError) throw countError
        
        setTotalBookings(count || 0)

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
          .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)

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
              console.log('💵 Processing completed payment with ID:', payment.id);
              
              // First try to get receipt using RPC method which matches how they're created
              const { data: rpcReceipt, error: rpcError } = await supabase
                .rpc('get_receipt_by_payment_id', { payment_id_param: payment.id });
              
              // Log the result for debugging
              if (rpcError) {
                console.error('🔴 RPC receipt lookup error:', rpcError);
              } else {
                console.log('📝 RPC receipt lookup result:', rpcReceipt);
              }
              
              // If RPC fails or returns no result, fallback to direct table query
              if (rpcError || !rpcReceipt || (Array.isArray(rpcReceipt) && rpcReceipt.length === 0)) {
                console.log('🔍 Trying direct payment_receipts lookup for payment:', payment.id);
                const { data: directReceipt, error: directError } = await supabase
                  .from('payment_receipts')
                  .select('*')
                  .eq('payment_id', payment.id)
                  .single();
                
                if (!directError && directReceipt) {
                  console.log('✅ Found receipt via direct query:', directReceipt);
                  return {
                    ...bookingForCard,
                    receipt: directReceipt
                  };
                } else {
                  console.log('❌ Receipt not found for payment:', payment.id, directError);
                }
              } else {
                // The RPC might return an array, so handle that case
                const receipt = Array.isArray(rpcReceipt) ? rpcReceipt[0] : rpcReceipt;
                console.log('✅ Found receipt via RPC:', receipt);
                
                return {
                  ...bookingForCard,
                  receipt: receipt
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
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Loading your bookings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <h3 className="font-semibold mb-2">Error loading bookings</h3>
        <p className="text-sm text-muted-foreground">Please try again later</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by city, driver or status..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <Badge variant="outline" className="flex items-center gap-1">
            <span>{filteredBookings.length} results</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )}
      </div>

      {!filteredBookings.length ? (
        <div className="text-center py-8">
          <h3 className="font-semibold mb-2">No bookings found</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery 
              ? "No bookings match your search. Try different keywords." 
              : "You haven't made any bookings yet"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {currentPageBookings.filter(booking => booking.ride).map(booking => {
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

          {/* Pagination with results info */}
          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Showing {Math.min(filteredBookings.length, (page - 1) * itemsPerPage + 1)}-
              {Math.min(filteredBookings.length, page * itemsPerPage)} of {filteredBookings.length} bookings
            </div>
            
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  {page > 1 && (
                    <PaginationItem>
                      <PaginationPrevious 
                        href={`/bookings?page=${page - 1}`}
                        onClick={(e) => {
                          if (searchQuery) {
                            e.preventDefault();
                            if (page > 1) router.push(`/bookings?page=${page - 1}`);
                          }
                        }}
                      />
                    </PaginationItem>
                  )}
                  
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    // Show pages around the current page
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else {
                      // Calculate start page ensuring we always show 5 pages
                      let startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                      pageNum = startPage + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href={`/bookings?page=${pageNum}`}
                          isActive={page === pageNum}
                          onClick={(e) => {
                            if (searchQuery) {
                              e.preventDefault();
                              router.push(`/bookings?page=${pageNum}`);
                            }
                          }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {page < totalPages && (
                    <PaginationItem>
                      <PaginationNext 
                        href={`/bookings?page=${page + 1}`}
                        onClick={(e) => {
                          if (searchQuery) {
                            e.preventDefault();
                            if (page < totalPages) router.push(`/bookings?page=${page + 1}`);
                          }
                        }}
                      />
                    </PaginationItem>
                  )}
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </>
      )}
    </div>
  )
}
