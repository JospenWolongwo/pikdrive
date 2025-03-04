'use client'

import { useState, useEffect, useCallback } from "react"
import { useSupabase } from "@/providers/SupabaseProvider"
import { useChat } from "@/providers/ChatProvider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Phone, MapPin, Calendar, Clock } from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/utils"
import { ChatDialog } from "@/components/chat/chat-dialog"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"

interface Booking {
  id: string
  ride_id: string
  seats: number
  status: string
  created_at: string
  payment_status: string
  user_id: string
  user: {
    id: string
    full_name: string
    avatar_url?: string
    phone_number?: string
  }
  ride: {
    id: string
    from_city: string
    to_city: string
    departure_time: string
    price: number
    driver_id: string
  }
}

export default function DriverBookings() {
  const { supabase, user } = useSupabase()
  const { unreadCounts, subscribeToRide } = useChat()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 10
  const [selectedChat, setSelectedChat] = useState<{
    ride_id: string
    user: { id: string; full_name: string; avatar_url?: string }
  } | null>(null)

  const loadBookings = useCallback(async () => {
    if (!user) return

    try {
      // 1. Get total count first
      const { count, error: countError } = await supabase
        .from('rides')
        .select('id', { count: 'exact' })
        .eq('driver_id', user.id)

      if (countError) {
        console.error('Error getting count:', countError)
        return
      }

      setTotalPages(Math.ceil((count || 0) / itemsPerPage))

      // 2. Get all rides for the driver with pagination
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select('id')
        .eq('driver_id', user.id)
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      if (ridesError) {
        console.error('❌ Error checking rides:', ridesError)
        return
      }

      if (!rides?.length) {
        setBookings([])
        return
      }

      const rideIds = rides.map(r => r.id)

      // 3. Get all data in parallel
      const [
        { data: rawBookings, error: bookingsError },
        { data: users, error: usersError },
        { data: bookingRides, error: ridesDataError }
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .in('ride_id', rideIds),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url'),
        supabase
          .from('rides')
          .select('id, from_city, to_city, departure_time, price, driver_id')
          .in('id', rideIds)
      ])

      if (bookingsError || usersError || ridesDataError) {
        console.error('Error loading data:', { bookingsError, usersError, ridesDataError })
        return
      }

      // 4. Create lookup maps and combine data
      const userMap = new Map(users?.map(u => [u.id, u]) || [])
      const rideMap = new Map(bookingRides?.map(r => [r.id, r]) || [])

      const enrichedBookings = (rawBookings || []).map(booking => ({
        ...booking,
        user: userMap.get(booking.user_id) || {
          id: booking.user_id,
          full_name: 'Unknown User',
          avatar_url: null
        },
        ride: rideMap.get(booking.ride_id) || {
          id: booking.ride_id,
          from_city: 'Unknown',
          to_city: 'Unknown',
          departure_time: new Date().toISOString(),
          price: 0
        }
      }))

      setBookings(enrichedBookings)
    } catch (error) {
      console.error('❌ Error in loadBookings:', error)
    } finally {
      setLoading(false)
    }
  }, [user, supabase, currentPage])

  // Initial load
  useEffect(() => {
    if (user) {
      loadBookings()
    }
  }, [loadBookings, user, currentPage])

  // Subscribe to bookings changes
  useEffect(() => {
    if (!user) return

    console.log("🎧 Setting up booking subscriptions...")
    
    // Subscribe to new bookings for any of the driver's rides
    const bookingsSubscription = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log("📬 Received booking update:", payload)
          await loadBookings()
        }
      )
      .subscribe((status) => {
        console.log("📡 Bookings subscription status:", status)
      })

    // Subscribe to payment status changes
    const paymentsSubscription = supabase
      .channel('payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        async (payload) => {
          console.log("💰 Payment update received:", payload)
          await loadBookings()
        }
      )
      .subscribe((status) => {
        console.log("📡 Payments subscription status:", status)
      })

    return () => {
      console.log("👋 Cleaning up subscriptions...")
      bookingsSubscription.unsubscribe()
      paymentsSubscription.unsubscribe()
    }
  }, [user, supabase, loadBookings])

  // Subscribe to messages for each booking's ride
  useEffect(() => {
    if (!bookings.length) return

    const rideIds = new Set(bookings.map(b => b.ride_id))
    console.log("💬 Setting up message subscriptions for rides:", Array.from(rideIds))
    rideIds.forEach(rideId => {
      subscribeToRide(rideId)
    })
  }, [bookings, subscribeToRide])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-500'
      case 'pending':
        return 'bg-yellow-500'
      case 'cancelled':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (loading) {
    return <div className="container py-10">Loading...</div>
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your Bookings</h1>
        <p className="text-muted-foreground mt-2">Manage your ride bookings and communicate with passengers</p>
      </div>

      <div className="space-y-6">
        {bookings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Bookings Yet</CardTitle>
              <p className="text-muted-foreground">
                You don't have any bookings for your rides yet.
              </p>
            </CardHeader>
          </Card>
        ) : (
          <>
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        {booking.ride.from_city} to {booking.ride.to_city}
                      </CardTitle>
                      <div className="space-y-1 mt-2">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Departure: {format(new Date(booking.ride.departure_time), "PPP p")}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Booked: {format(new Date(booking.created_at), "PPP p")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <Badge className={getStatusColor(booking.status)}>
                        Booking: {booking.status}
                      </Badge>
                      {booking.payment_status && (
                        <div>
                          <Badge variant={booking.payment_status === 'completed' ? 'default' : 'secondary'}>
                            Payment: {booking.payment_status === 'completed' ? 'Completed' : 'Pending'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar>
                          <AvatarImage
                            src={booking.user.avatar_url || '/placeholder-avatar.png'}
                            alt={booking.user.full_name}
                          />
                          <AvatarFallback>{booking.user.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{booking.user.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {booking.seats} {booking.seats === 1 ? 'seat' : 'seats'} • {formatCurrency(booking.ride.price * booking.seats)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {booking.user.phone_number && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <a href={`tel:${booking.user.phone_number}`}>
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedChat({
                          ride_id: booking.ride_id,
                          user: booking.user
                        })}
                        className="relative"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message
                        {unreadCounts.find(c => 
                          c.rideId === booking.ride_id && 
                          booking.user_id
                        )?.count > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full"
                          >
                            {unreadCounts.find(c => 
                              c.rideId === booking.ride_id && 
                              booking.user_id
                            )?.count}
                          </Badge>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage > 1) setCurrentPage(currentPage - 1)
                      }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(page)
                        }}
                        isActive={currentPage === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                      }}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>

      {selectedChat && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={() => setSelectedChat(null)}
          rideId={selectedChat.ride_id}
          otherUserId={selectedChat.user.id}
          otherUserName={selectedChat.user.full_name}
          otherUserAvatar={selectedChat.user.avatar_url}
        />
      )}
    </div>
  )
}
