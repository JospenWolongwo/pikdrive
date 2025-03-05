'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/SupabaseProvider'
import { useChat } from '@/providers/ChatProvider'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar, Users, MessageCircle, Phone, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { cameroonCities, citiesByRegion, urbanCommunes } from '@/app/data/cities'
import { Slider } from '@/components/ui/slider'
import { ChatDialog } from '@/components/chat/chat-dialog'
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from '@/components/ui/pagination'
import { BookingModal } from './booking-modal'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

interface Booking {
  seats: number
}

interface Ride {
  id: string
  driver_id: string
  from_city: string
  to_city: string
  price: number
  departure_time: string
  estimated_duration: string
  seats_available: number
  total_seats: number
  car_model?: string
  car_color?: string
  bookings?: Booking[]
  driver?: {
    id: string
    full_name: string
    avatar_url?: string
    image?: string
    rating?: number
    trips?: number;
  };
}

interface UnreadCount {
  rideId: string
  count: number
}

interface UnreadCounts {
  [key: string]: number
}

const sortedCameroonCities = [...Array.from(urbanCommunes), ...Array.from(cameroonCities)].sort((a, b) => a.localeCompare(b))

export default function RidesPage() {
  const { supabase, user } = useSupabase()
  const { unreadCounts: unreadCountsArray, subscribeToRide } = useChat()
  const router = useRouter()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [selectedChatRide, setSelectedChatRide] = useState<Ride | null>(null)
  const [message, setMessage] = useState('')
  const [seats, setSeats] = useState(1)
  
  // Search filters
  const [fromCity, setFromCity] = useState<string | null>(null)
  const [toCity, setToCity] = useState<string | null>(null)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(20000)
  const [minSeats, setMinSeats] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 10

  // Convert unreadCounts array to dictionary
  const unreadCounts: UnreadCounts = (unreadCountsArray || []).reduce((acc, curr) => ({
    ...acc,
    [curr.rideId]: curr.count
  }), {})

  const loadRides = async () => {
    try {
      setLoading(true);
      
      // First get total count for pagination
      let countQuery = supabase
        .from('rides')
        .select('id', { count: 'exact' })
        .gt('departure_time', new Date().toISOString())

      // Apply filters to count query
      if (fromCity && fromCity !== 'any') {
        countQuery = countQuery.eq('from_city', fromCity)
      }
      if (toCity && toCity !== 'any') {
        countQuery = countQuery.eq('to_city', toCity)
      }
      if (minPrice > 0) {
        countQuery = countQuery.gte('price', minPrice)
      }
      if (maxPrice < 20000) {
        countQuery = countQuery.lte('price', maxPrice)
      }

      const { count, error: countError } = await countQuery

      if (countError) throw countError
      
      setTotalPages(Math.ceil((count || 0) / itemsPerPage))

      // Then get paginated data
      let query = supabase
        .from('rides')
        .select(`
          *,
          driver:profiles(id, full_name, avatar_url),
          bookings(id, seats)
        `)
        .gt('departure_time', new Date().toISOString())
        .order('departure_time', { ascending: true })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      // Apply filters
      if (fromCity && fromCity !== 'any') {
        query = query.eq('from_city', fromCity)
      }
      if (toCity && toCity !== 'any') {
        query = query.eq('to_city', toCity)
      }
      if (minPrice > 0) {
        query = query.gte('price', minPrice)
      }
      if (maxPrice < 20000) {
        query = query.lte('price', maxPrice)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      // Set empty array if no data
      if (!data) {
        setRides([])
        return
      }

      const processedRides = data.map((ride: Ride) => ({
        ...ride,
        seats_available: ride.total_seats - (ride.bookings?.reduce((sum, b) => sum + (b.seats || 0), 0) || 0)
      }))

      setRides(processedRides)
    } catch (error) {
      console.error('Error:', error)
      toast({
        variant: "destructive",
        title: "Error loading rides",
        description: "Please try again later."
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchRides = async () => {
      await loadRides();
    };

    fetchRides();
  }, [fromCity, toCity, minPrice, maxPrice, currentPage]);

  useEffect(() => {
    rides.forEach(ride => {
      subscribeToRide(ride.id)
    })
  }, [rides, subscribeToRide])

  const handleBooking = (ride: Ride) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to book rides.",
        variant: "destructive"
      })
      router.push('/auth?redirect=/rides')
      return
    }
    setSelectedRide(ride)
  }

  const handleBookingComplete = () => {
    loadRides() // Refresh the rides list
  }

  const handleOpenChat = async (ride: Ride) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to message drivers.",
        variant: "destructive"
      })
      router.push('/auth?redirect=/rides')
      return
    }

    setSelectedChatRide(ride)
  }

  const handleSendMessage = async () => {
    if (!user || !selectedRide) return

    // Filter sensitive content
    const filteredMessage = filterSensitiveContent(message)
    
    if (filteredMessage !== message) {
      toast({
        title: "Message Modified",
        description: "Your message was modified to remove sensitive information.",
        variant: "default"
      })
    }

    try {
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            receiver_id: selectedRide.driver_id,
            ride_id: selectedRide.id,
            content: filteredMessage,
            status: 'sent'
          }
        ])

      if (error) throw error

      toast({
        title: "Success",
        description: "Message sent successfully!"
      })

      setMessage('')
      setSelectedRide(null)
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again."
      })
    }
  }

  const filterSensitiveContent = (text: string): string => {
    // Filter phone numbers
    text = text.replace(/\b\d{10}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone number removed]')
    
    // Filter email addresses
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email removed]')
    
    // Filter WhatsApp mentions
    text = text.replace(/\b(?:whatsapp|whats app|wa)\b/gi, '[messaging app]')
    
    // Filter common meeting places or arrangements
    const sensitiveWords = [
      'meet',
      'meetup',
      'meeting',
      'contact',
      'call me',
      'text me',
      'message me',
      'telegram',
      'signal',
      'facebook',
      'fb',
      'instagram',
      'ig',
      'dm'
    ]
    
    const sensitivePattern = new RegExp(`\\b(${sensitiveWords.join('|')})\\b`, 'gi')
    text = text.replace(sensitivePattern, '[arrangement removed]')
    
    return text
  }

  if (loading) {
    return (
      <div className="container py-10">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Available Rides</h1>
          <p className="text-muted-foreground">Find and book your next ride</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 min-w-[280px]">
                <Label htmlFor="from-city" className="md:text-right">
                  From
                </Label>
                <div className="md:col-span-3 w-full">
                  <SearchableSelect
                    options={sortedCameroonCities}
                    value={fromCity || ''}
                    onValueChange={setFromCity}
                    placeholder="Select departure city"
                    searchPlaceholder="Search departure city..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 min-w-[280px]">
                <Label htmlFor="to-city" className="md:text-right">
                  To
                </Label>
                <div className="md:col-span-3 w-full">
                  <SearchableSelect
                    options={sortedCameroonCities}
                    value={toCity || ''}
                    onValueChange={setToCity}
                    placeholder="Select destination city"
                    searchPlaceholder="Search destination city..."
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-secondary' : ''}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid gap-6 p-6 border rounded-lg">
              <div className="space-y-2">
                <Label>Price Range (FCFA)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(Number(e.target.value))}
                    className="w-24"
                    min={0}
                    max={maxPrice}
                  />
                  <span>to</span>
                  <Input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-24"
                    min={minPrice}
                    max={20000}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Minimum Seats</Label>
                <Input
                  type="number"
                  value={minSeats}
                  onChange={(e) => setMinSeats(Math.max(1, Math.min(4, Number(e.target.value))))}
                  min={1}
                  max={4}
                  className="w-24"
                />
              </div>
            </div>
          )}
        </div>

        {rides.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">
              {(fromCity && fromCity !== 'any') || (toCity && toCity !== 'any') 
                ? 'No rides found matching your search.' 
                : 'No rides available at the moment.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rides.map((ride) => (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={ride.driver?.avatar_url} />
                        <AvatarFallback>{ride.driver?.full_name?.charAt(0) || 'D'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{ride.driver?.full_name || 'Driver'}</CardTitle>
                        <CardDescription>{ride.car_model} • {ride.car_color}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-medium">{ride.from_city}</div>
                          <Separator className="my-2" />
                          <div className="font-medium">{ride.to_city}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>{format(new Date(ride.departure_time), 'PPP p')}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>{ride.seats_available} seats available</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center pt-4 border-t">
                    <Badge variant="secondary">{ride.price.toLocaleString()} FCFA</Badge>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenChat(ride)}
                        className="relative"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Message {ride.driver?.full_name?.split(' ')[0] || 'Driver'}
                        {unreadCounts[ride.id] > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center"
                          >
                            {unreadCounts[ride.id]}
                          </Badge>
                        )}
                      </Button>
                      <Button 
                        variant="default"
                        size="sm"
                        disabled={ride.seats_available === 0}
                        onClick={() => handleBooking(ride)}
                      >
                        {ride.seats_available === 0 ? 'Full' : 'Book Now'}
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {!loading && rides.length > 0 && (
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
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber: number
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

            {currentPage < totalPages && (
              <PaginationItem>
                <PaginationNext 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(prev => Math.min(totalPages, prev + 1))
                  }} 
                />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
      {selectedRide && (
        <BookingModal
          isOpen={!!selectedRide}
          onClose={() => setSelectedRide(null)}
          ride={selectedRide}
          onBookingComplete={handleBookingComplete}
        />
      )}
      {selectedChatRide && (
        <ChatDialog
          isOpen={!!selectedChatRide}
          onClose={() => setSelectedChatRide(null)}
          rideId={selectedChatRide.id}
          otherUserId={selectedChatRide.driver_id}
          otherUserName={selectedChatRide.driver?.full_name || 'Driver'}
          otherUserAvatar={selectedChatRide.driver?.avatar_url}
        />
      )}
    </div>
  )
}
