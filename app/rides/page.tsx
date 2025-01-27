'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { cameroonTowns } from '@/lib/towns'
import { Card } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CalendarIcon, MapPin, Users, Clock, Car, MessageCircle, Star, Plus } from 'lucide-react'
import { BookingModal } from './booking-modal'
import { ChatModal } from './chat-modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function RidesPage() {
  const { user } = useAuth()
  const [departure, setDeparture] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState<Date>()
  const [selectedRide, setSelectedRide] = useState<any>(null)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [isChatModalOpen, setIsChatModalOpen] = useState(false)
  const [rides, setRides] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const townOptions = cameroonTowns.map(town => ({
    value: town.toLowerCase(),
    label: town
  }))

  const loadRides = async () => {
    try {
      setIsLoading(true)
      // First, try to get existing rides
      const { data: existingRides, error: fetchError } = await supabase
        .from('rides')
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey (
            id,
            name,
            phone
          )
        `)

      if (fetchError) {
        console.error('Error fetching rides:', fetchError)
        throw fetchError
      }

      console.log('Loaded rides:', existingRides)
      setRides(existingRides || [])
    } catch (error) {
      console.error('Error loading rides:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRides()
  }, [])

  const createTestRide = async () => {
    if (!user) return
    
    try {
      setIsLoading(true)
      console.log('Creating test ride for user:', user.id)

      // First check if the user exists in the profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        // Create profile if it doesn't exist
        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              name: 'Test Driver',
              phone: user.phone || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])

        if (createProfileError) {
          console.error('Error creating profile:', createProfileError)
          throw createProfileError
        }
      }

      // Now create the ride
      const { data: newRide, error: createError } = await supabase
        .from('rides')
        .insert([
          {
            driver_id: user.id,
            from_city: 'Douala',
            to_city: 'Yaoundé',
            departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            price: 5000,
            seats_available: 4,
            car_model: 'Toyota Corolla',
            car_color: 'Silver',
            car_year: '2019'
          }
        ])
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey (
            id,
            name,
            phone
          )
        `)
        .single()

      if (createError) {
        console.error('Error creating ride:', createError)
        throw createError
      }

      console.log('Created test ride:', newRide)
      await loadRides()
    } catch (error) {
      console.error('Error in createTestRide:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBookNow = (ride: any) => {
    setSelectedRide(ride)
    setIsBookingModalOpen(true)
  }

  const handleChat = (ride: any) => {
    setSelectedRide({
      ...ride,
      driver: {
        ...ride.driver,
        id: ride.driver_id,
        name: ride.driver?.name || 'Driver',
        image: '/placeholder-avatar.png',
        rating: 4.8,
        trips: 156
      }
    })
    setIsChatModalOpen(true)
  }

  return (
    <div className="container py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Find a Ride</h1>
        {user && (
          <Button onClick={createTestRide} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            Create Test Ride
          </Button>
        )}
      </div>
      
      {/* Search Form */}
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <Combobox
              value={departure}
              onChange={setDeparture}
              options={townOptions}
              placeholder="From"
            />
          </div>
          <div>
            <Combobox
              value={destination}
              onChange={setDestination}
              options={townOptions}
              placeholder="To"
            />
          </div>
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button>Search</Button>
        </div>
      </Card>

      {/* Rides List */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">Available Rides</h2>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No rides available at the moment.</p>
            {user && (
              <Button onClick={createTestRide}>
                <Plus className="h-4 w-4 mr-2" />
                Create Test Ride
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rides.map((ride) => (
              <Card key={ride.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
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
                          {format(new Date(ride.departure_time), 'HH:mm')}
                        </div>
                        <div className="flex items-center">
                          <Users className="mr-1 h-4 w-4" />
                          {ride.seats_available} seats
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary mb-2">
                        {ride.price} FCFA
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src="/placeholder-avatar.png" alt={ride.driver?.name} />
                        <AvatarFallback>{ride.driver?.name?.slice(0, 2) || 'DR'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{ride.driver?.name || 'Driver'}</div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Star className="h-3 w-3 fill-primary text-primary mr-1" />
                          4.8 • 156 trips
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      <div>{ride.car_model}</div>
                      <div>{ride.car_color} • {ride.car_year}</div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleChat(ride)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="sr-only">Chat with driver</span>
                    </Button>
                    <Button size="sm" onClick={() => handleBookNow(ride)}>
                      Book Now
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        ride={selectedRide}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        ride={selectedRide}
      />
    </div>
  )
}