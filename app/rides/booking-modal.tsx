"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Users, Clock, Car } from "lucide-react"

interface Ride {
  from: string
  to: string
  price: string
  duration: string
  time: string
  seatsAvailable: number
}

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  ride: Ride | null
}

export function BookingModal({ isOpen, onClose, ride }: BookingModalProps) {
  const [step, setStep] = useState(1)
  const [seats, setSeats] = useState(1)
  const [loading, setLoading] = useState(false)

  if (!ride) return null

  const totalPrice = seats * parseInt(ride.price)

  const handleBooking = async () => {
    try {
      setLoading(true)
      // Add booking logic here
      await new Promise(resolve => setTimeout(resolve, 1000))
      setStep(2)
    } catch (error) {
      console.error('Booking failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{ride.from}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{ride.to}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="mr-1 h-4 w-4" />
                      {ride.time}
                    </div>
                    <div className="flex items-center">
                      <Car className="mr-1 h-4 w-4" />
                      {ride.duration}h
                    </div>
                    <div className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {ride.seatsAvailable} seats available
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats">Number of Seats</Label>
                <Input
                  id="seats"
                  type="number"
                  min={1}
                  max={ride.seatsAvailable}
                  value={seats}
                  onChange={(e) => setSeats(parseInt(e.target.value))}
                />
              </div>

              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total Price:</span>
                <span className="text-primary">{totalPrice} FCFA</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleBooking} disabled={loading}>
                {loading ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </div>
          </>
        )

      case 2:
        return (
          <div className="text-center space-y-4">
            <div className="text-green-500 font-semibold text-lg">
              Booking Confirmed!
            </div>
            <p className="text-muted-foreground">
              Your ride has been booked successfully. You will receive a confirmation
              message shortly.
            </p>
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Your Ride</DialogTitle>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  )
}