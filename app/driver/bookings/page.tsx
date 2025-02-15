'use client'

import { useState, useEffect } from "react"
import { useSupabase } from "@/providers/SupabaseProvider"
import { useChat } from "@/providers/ChatProvider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Phone } from "lucide-react"
import { format } from "date-fns"
import { ChatDialog } from "@/components/chat/chat-dialog"

interface Booking {
  id: string
  ride_id: string
  seats: number
  status: string
  created_at: string
  user: {
    id: string
    full_name: string
    avatar_url?: string
  }
  ride: {
    from_city: string
    to_city: string
    departure_time: string
  }
}

export default function DriverBookings() {
  const { supabase, user } = useSupabase()
  const { unreadCounts } = useChat()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<{
    ride_id: string
    user: { id: string; full_name: string; avatar_url?: string }
  } | null>(null)

  useEffect(() => {
    const loadBookings = async () => {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id,
            ride_id,
            seats,
            status,
            created_at,
            user:user_id (
              id,
              full_name,
              avatar_url
            ),
            ride:ride_id (
              from_city,
              to_city,
              departure_time
            )
          `)
          .eq('ride.driver_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setBookings(data || [])
      } catch (error) {
        console.error('Error loading bookings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBookings()
  }, [user, supabase])

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
          bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {booking.ride.from_city} to {booking.ride.to_city}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Departure: {format(new Date(booking.ride.departure_time), "PPP p")}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage 
                        src={booking.user.avatar_url || undefined} 
                        alt={booking.user.full_name} 
                      />
                      <AvatarFallback>
                        {booking.user.full_name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{booking.user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{booking.seats} seats</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                        booking.user.id
                      )?.count > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full"
                        >
                          {unreadCounts.find(c => 
                            c.rideId === booking.ride_id && 
                            booking.user.id
                          )?.count}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
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
