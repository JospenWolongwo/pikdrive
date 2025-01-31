'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/SupabaseProvider'
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
import { ChatModal } from './chat-modal'

interface Ride {
  id: string;
  driver_id: string;
  from_city: string;
  to_city: string;
  price: number;
  departure_time: string;
  estimated_duration: string;
  seats_available: number;
  car_model?: string;
  car_color?: string;
  bookings?: Array<{ seats?: number }>;
  driver?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    image?: string;
    rating?: number;
    trips?: number;
  };
}

const sortedCameroonCities = [...Array.from(urbanCommunes), ...Array.from(cameroonCities)].sort((a, b) => a.localeCompare(b))

export default function RidesPage() {
  const { supabase, user } = useSupabase()
  const router = useRouter()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null)
  const [message, setMessage] = useState('')
  const [seats, setSeats] = useState(1)
  
  // Search filters
  const [fromCity, setFromCity] = useState<string | null>(null)
  const [toCity, setToCity] = useState<string | null>(null)
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(20000)
  const [minSeats, setMinSeats] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const loadRides = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('rides')
        .select(`
          *,
          driver:profiles(id, full_name, avatar_url),
          bookings(id, seats)
        `)
        .gt('departure_time', new Date().toISOString())
        .order('departure_time', { ascending: true })

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

      // Calculate remaining seats and filter rides
      const ridesWithSeats = data
        .map((ride: any) => {
          const totalBookedSeats = (ride.bookings || []).reduce((acc: number, booking: any) => {
            return acc + (booking?.seats || 0)
          }, 0)

          const remainingSeats = Math.max(0, ride.seats_available - totalBookedSeats)

          if (remainingSeats < minSeats) {
            return null
          }

          return {
            ...ride,
            seats_available: remainingSeats,
            driver: {
              ...ride.driver,
              name: ride.driver?.full_name || 'Unknown Driver'
            }
          }
        })
        .filter(Boolean)

      setRides(ridesWithSeats)
    } catch (error) {
      console.error('Error loading rides:', error)
      toast({
        variant: "destructive",
        title: "Error loading rides",
        description: error instanceof Error ? error.message : "Please try again later."
      })
      setRides([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fetchRides = async () => {
      await loadRides();
    };

    fetchRides();
  }, [fromCity, toCity, minPrice, maxPrice, minSeats]);

  const handleBooking = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to book rides.",
        variant: "destructive"
      })
      router.push('/auth?redirect=/rides')
      return
    }

    if (!selectedRide) {
      toast({
        title: "Error",
        description: "Please select a ride first."
      })
      return
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            ride_id: selectedRide.id,
            user_id: user.id,
            seats: seats,
            status: 'pending'
          }
        ])

      if (error) throw error

      toast({
        title: "Success",
        description: "Your booking request has been sent."
      })

      // Refresh the rides list
      loadRides()
    } catch (error) {
      console.error('Error booking ride:', error)
      toast({
        variant: "destructive",
        title: "Error booking ride",
        description: error instanceof Error ? error.message : "Please try again later."
      })
    }
  }

  const handleOpenChat = async (ride: Ride) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send messages to drivers.",
        variant: "destructive"
      })
      router.push('/auth?redirect=/rides')
      return
    }

    setSelectedRide(ride)
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
    <div className="container py-10">
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
              <Card key={ride.id} className="overflow-hidden">
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
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message {ride.driver?.full_name?.split(' ')[0] || 'Driver'}
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="default"
                          size="sm"
                          disabled={ride.seats_available === 0}
                        >
                          {ride.seats_available === 0 ? 'Full' : 'Book Now'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Book a Ride</DialogTitle>
                          <DialogDescription>
                            Enter the number of seats you want to book.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>Number of Seats</Label>
                            <Input
                              type="number"
                              min={1}
                              max={ride?.seats_available || 1}
                              value={seats}
                              onChange={(e) => setSeats(parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={() => handleBooking()}>Book Now</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      {selectedRide && (
        <ChatModal
          isOpen={!!selectedRide}
          onClose={() => setSelectedRide(null)}
          rideId={selectedRide.id}
          driverId={selectedRide.driver_id}
        />
      )}
    </div>
  )
}
