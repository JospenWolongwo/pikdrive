"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { useChat } from "@/providers/ChatProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, MessageCircle, Plus, Users } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { ChatDialog } from '@/components/chat/chat-dialog'
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Phone } from "lucide-react"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"

interface Ride {
  id: string
  from_city: string
  to_city: string
  departure_time: string
  price: number
  seats_available: number
  total_seats: number
  car_model: string
  car_color: string
  car_year: number
  created_at: string
  bookings: Array<{
    id: string
    ride_id: string
    seats: number
    status: string
    user: {
      id: string
      full_name: string
      avatar_url?: string
    }
  }>
  messages: Array<{
    id: string
    ride_id: string
    content: string
    created_at: string
    sender: {
      id: string
      full_name: string
    }
  }>
}

interface Booking {
  id: string
  ride_id: string
  seats: number
  status: string
  user: {
    id: string
    full_name: string
    avatar_url?: string
  }
}

interface Message {
  id: string
  ride_id: string
  content: string
  created_at: string
  sender: {
    id: string
    full_name: string
  }
}

interface UnreadCount {
  rideId: string
  count: number
}

export default function DriverDashboard() {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const { unreadCounts, subscribeToRide } = useChat()
  const { toast } = useToast()
  const [ridesData, setRidesData] = useState<{
    rides: Ride[],
    lastUpdated: number
  }>({ rides: [], lastUpdated: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<{
    ride: Ride,
    user: { id: string; full_name: string; avatar_url?: string }
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 10

  const loadRides = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log("🚀 Starting fresh data load");

      // Get all rides without pagination to properly filter upcoming/past
      const { data: simpleRides, error: simpleError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("departure_time", { ascending: true });

      if (simpleError) throw simpleError;
      if (!simpleRides?.length) {
        console.log("💡 No rides found, resetting state");
        setRidesData({ rides: [], lastUpdated: Date.now() });
        return;
      }

      // 2. Fetch related data in parallel for all rides
      const rideIds = simpleRides.map((r: Ride) => r.id);
      
      const [
        { data: bookings },
        { data: messages }
      ] = await Promise.all([
        supabase.from("bookings").select("*, user:profiles(id, full_name, avatar_url)").in("ride_id", rideIds),
        supabase.from("messages").select("*, sender:profiles(id, full_name)").in("ride_id", rideIds)
      ]);

      // 3. Combine data with error handling
      const enrichedRides = simpleRides.map((ride: Ride) => ({
        ...ride,
        bookings: ride.bookings || [],
        messages: ride.messages || [],
        unreadCount: unreadCounts.find(u => u.rideId === ride.id)?.count || 0
      }));

      console.log("✅ Data load complete");
      setRidesData({
        rides: enrichedRides,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error("❌ Error loading rides:", error);
      toast({
        variant: "destructive",
        title: "Error loading rides",
        description: "Please try again later."
      });
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast]);

  // Load rides on mount and when user changes
  useEffect(() => {
    const initialLoad = async () => {
      await loadRides();
      router.replace("/driver/dashboard"); // Clear any refresh params
    };
    
    if (user) initialLoad();
  }, [user, loadRides, router]);

  // Subscribe to messages for each ride
  useEffect(() => {
    ridesData.rides.forEach(ride => {
      subscribeToRide(ride.id)
    })
  }, [ridesData.rides, subscribeToRide])

  // Get current time in UTC
  const now = new Date()
  const nowUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ))

  // Calculate upcoming and past rides
  const upcomingRides = useMemo(() => {
    console.log("Calculating upcoming rides from", ridesData.rides.length, "total rides")
    return ridesData.rides
      .filter(ride => new Date(ride.departure_time).getTime() > nowUTC.getTime())
      .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime())
  }, [ridesData.rides, nowUTC])

  const pastRides = useMemo(() => {
    return ridesData.rides
      .filter(ride => new Date(ride.departure_time).getTime() <= nowUTC.getTime())
      .sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime())
  }, [ridesData.rides, nowUTC])

  // Debug log for overall ride counts
  console.log("Ride counts:", {
    total: ridesData.rides.length,
    upcoming: upcomingRides.length,
    past: pastRides.length,
    current_time: nowUTC.toISOString()
  })

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

  const handleOpenChat = (ride: Ride, user: { id: string; full_name: string; avatar_url?: string }) => {
    setSelectedChat({ ride, user })
  }

  if (loading) {
    return <div className="container py-10">Loading...</div>
  }

  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { supabase, user } = useSupabase()
  const { unreadCounts, subscribeToRide } = useChat()
  const { toast } = useToast()
  const [ridesData, setRidesData] = useState<{
    rides: Ride[],
    lastUpdated: number
  }>({ rides: [], lastUpdated: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<{
    ride: Ride,
    user: { id: string; full_name: string; avatar_url?: string }
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 10

  const loadRides = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log("🚀 Starting fresh data load");

      // Get all rides without pagination to properly filter upcoming/past
      const { data: simpleRides, error: simpleError } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("departure_time", { ascending: true });

      if (simpleError) throw simpleError;
      if (!simpleRides?.length) {
        console.log("💡 No rides found, resetting state");
        setRidesData({ rides: [], lastUpdated: Date.now() });
        return;
      }

      // 2. Fetch related data in parallel for all rides
      const rideIds = simpleRides.map((r: Ride) => r.id);
      
      const [
        { data: bookings },
        { data: messages }
      ] = await Promise.all([
        supabase.from("bookings").select("*, user:profiles(id, full_name, avatar_url)").in("ride_id", rideIds),
        supabase.from("messages").select("*, sender:profiles(id, full_name)").in("ride_id", rideIds)
      ]);

      // 3. Combine data with error handling
      const enrichedRides = simpleRides.map((ride: Ride) => ({
        ...ride,
        bookings: ride.bookings || [],
        messages: ride.messages || [],
        unreadCount: unreadCounts.find(u => u.rideId === ride.id)?.count || 0
      }));

      console.log("✅ Data load complete");
      setRidesData({
        rides: enrichedRides,
        lastUpdated: Date.now()
      });
    } catch (error) {
      console.error("❌ Error loading rides:", error);
      toast({
        variant: "destructive",
        title: "Error loading rides",
        description: "Please try again later."
      });
    } finally {
      setLoading(false);
    }
  }, [user, supabase, toast]);

  // Load rides on mount and when user changes
  useEffect(() => {
    const initialLoad = async () => {
      await loadRides();
      router.replace("/driver/dashboard"); // Clear any refresh params
    };
    
    if (user) initialLoad();
  }, [user, loadRides, router]);

  // Subscribe to messages for each ride
  useEffect(() => {
    ridesData.rides.forEach(ride => {
      subscribeToRide(ride.id)
    })
  }, [ridesData.rides, subscribeToRide])

  // Get current time in UTC
  const now = new Date()
  const nowUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ))

  // Calculate upcoming and past rides
  const upcomingRides = useMemo(() => {
    console.log("Calculating upcoming rides from", ridesData.rides.length, "total rides")
    return ridesData.rides
      .filter(ride => new Date(ride.departure_time).getTime() > nowUTC.getTime())
      .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime())
  }, [ridesData.rides, nowUTC])

  const pastRides = useMemo(() => {
    return ridesData.rides
      .filter(ride => new Date(ride.departure_time).getTime() <= nowUTC.getTime())
      .sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime())
  }, [ridesData.rides, nowUTC])

  // Debug log for overall ride counts
  console.log("Ride counts:", {
    total: ridesData.rides.length,
    upcoming: upcomingRides.length,
    past: pastRides.length,
    current_time: nowUTC.toISOString()
  })

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

  const handleOpenChat = (ride: Ride, user: { id: string; full_name: string; avatar_url?: string }) => {
    setSelectedChat({ ride, user })
  }

  if (loading) {
    return <div className="container py-10">Loading...</div>
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Driver Dashboard</h1>
          <p className="text-muted-foreground mt-2">Manage your rides and bookings</p>
        </div>
        <Button onClick={() => router.push("/driver/rides/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Ride
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6" onValueChange={(value) => {
        setCurrentPage(1) // Reset to first page when switching tabs
      }}>
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming Rides ({upcomingRides.length})
          </TabsTrigger>
          <TabsTrigger value="past">
            Past Rides ({pastRides.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-6">
          {upcomingRides.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Upcoming Rides</CardTitle>
                <CardDescription>
                  You haven't created any upcoming rides yet. Create a new ride to get started.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => router.push("/driver/rides/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Ride
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="space-y-6">
              {upcomingRides
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((ride: Ride) => (
                  <Card key={ride.id} className="group hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            {ride.from_city} to {ride.to_city}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(ride.departure_time), "PPP p")}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${ride.price}</div>
                          <div className="text-sm text-muted-foreground">
                            {ride.seats_available} of {ride.total_seats} seats available
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {ride.bookings.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Bookings</h4>
                            <div className="space-y-2">
                              {ride.bookings.map((booking: Booking) => (
                                <div
                                  key={booking.id}
                                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar>
                                      <AvatarImage 
                                        src={booking.user?.avatar_url || undefined} 
                                        alt={booking.user?.full_name || 'User'} 
                                      />
                                      <AvatarFallback>
                                        {booking.user?.full_name?.[0]?.toUpperCase() || 'U'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{booking.user?.full_name}</p>
                                      <p className="text-sm text-muted-foreground">{booking.seats} seats</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleOpenChat(ride, booking.user)}
                                      className="relative"
                                    >
                                      <MessageCircle className="h-4 w-4 mr-2" />
                                      Message
                                      {(() => {
                                        const count = unreadCounts?.find(c =>
                                          c.rideId === ride.id
                                        )?.count;
                                        return count && count > 0 ? (
                                          <Badge 
                                            variant="destructive" 
                                            className="ml-2"
                                          >
                                            {count}
                                          </Badge>
                                        ) : null;
                                      })()}
                                    </Button>
                                    <Button variant="default" size="sm">
                                      <Phone className="h-4 w-4 mr-2" />
                                      Call
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ride.messages.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Recent Messages</h4>
                            <div className="space-y-2">
                              {ride.messages.slice(0, 3).map((message: Message) => (
                                <div
                                  key={message.id}
                                  className="flex items-start gap-2 p-2 rounded-lg bg-muted"
                                >
                                  <MessageCircle className="w-4 h-4 mt-1" />
                                  <div>
                                    <div className="text-sm font-medium">
                                      {message.sender.full_name}
                                    </div>
                                    <div className="text-sm">{message.content}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(message.created_at), "PP p")}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {ride.messages.length > 3 && (
                                <Button variant="link" className="text-sm p-0">
                                  View all {ride.messages.length} messages
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full" onClick={() => router.push(`/driver/rides/${ride.id}`)}>
                        Manage Ride
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              
              {/* Show pagination only if we have more items than itemsPerPage */}
              {upcomingRides.length > itemsPerPage && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    {currentPage > 1 && (
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(prev => Math.max(1, prev - 1))
                          }} 
                        />
                      </PaginationItem>
                    )}
                    
                    {Array.from({ length: Math.min(5, Math.ceil(upcomingRides.length / itemsPerPage)) }, (_, i) => {
                      let pageNumber: number
                      const totalPages = Math.ceil(upcomingRides.length / itemsPerPage)
                      if (totalPages <= 5) {
                        pageNumber = i + 1
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i
                      } else {
                        pageNumber = currentPage - 2 + i
                      }

                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(pageNumber)
                            }}
                            isActive={currentPage === pageNumber}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}

                    {currentPage < Math.ceil(upcomingRides.length / itemsPerPage) && (
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(prev => Math.min(Math.ceil(upcomingRides.length / itemsPerPage), prev + 1))
                          }} 
                        />
                      </PaginationItem>
                    )}
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-6">
          {pastRides.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Past Rides</CardTitle>
                <CardDescription>
                  You haven't completed any rides yet.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-6">
              {pastRides
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((ride: Ride) => (
                  <Card key={ride.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            {ride.from_city} to {ride.to_city}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(ride.departure_time), "PPP p")}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${ride.price}</div>
                          <div className="text-sm text-muted-foreground">
                            {ride.total_seats - ride.seats_available} passengers
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {ride.bookings.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Passengers</h4>
                            <div className="space-y-2">
                              {ride.bookings
                                .filter(booking => booking.status === 'confirmed')
                                .map((booking: Booking) => (
                                  <div
                                    key={booking.id}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-muted"
                                  >
                                    <Users className="w-4 h-4" />
                                    <span>{booking.user.full_name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      ({booking.seats} {booking.seats === 1 ? 'seat' : 'seats'})
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            
              {/* Show pagination only if we have more items than itemsPerPage */}
              {pastRides.length > itemsPerPage && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    {currentPage > 1 && (
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(prev => Math.max(1, prev - 1))
                          }} 
                        />
                      </PaginationItem>
                    )}
                    
                    {Array.from({ length: Math.min(5, Math.ceil(pastRides.length / itemsPerPage)) }, (_, i) => {
                      let pageNumber: number
                      const totalPages = Math.ceil(pastRides.length / itemsPerPage)
                      if (totalPages <= 5) {
                        pageNumber = i + 1
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i
                      } else {
                        pageNumber = currentPage - 2 + i
                      }

                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(pageNumber)
                            }}
                            isActive={currentPage === pageNumber}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}

                    {currentPage < Math.ceil(pastRides.length / itemsPerPage) && (
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            setCurrentPage(prev => Math.min(Math.ceil(pastRides.length / itemsPerPage), prev + 1))
                          }} 
                        />
                      </PaginationItem>
                    )}
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {selectedChat && (
        <ChatDialog
          isOpen={!!selectedChat}
          onClose={() => setSelectedChat(null)}
          rideId={selectedChat.ride.id}
          otherUserId={selectedChat.user.id}
          otherUserName={selectedChat.user.full_name}
          otherUserAvatar={selectedChat.user.avatar_url}
        />
      )}
    </div>
  )
}
