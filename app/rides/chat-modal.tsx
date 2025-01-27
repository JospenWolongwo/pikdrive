'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChatWindow } from '@/components/chat/chat-window'
import { getConversation, createConversation } from '@/lib/messages'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ChatModalProps {
  isOpen: boolean
  onClose: () => void
  ride: {
    id: string
    driver: {
      id: string
      name: string
      image: string
      rating: number
      trips: number
    }
  }
}

export function ChatModal({ isOpen, onClose, ride }: ChatModalProps) {
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeChat = async () => {
      if (!user || !ride) return

      try {
        setIsLoading(true)
        setError(null)
        console.log('Initializing chat with ride:', ride)
        console.log('Current user:', user)

        // Try to get existing conversation
        const conversation = await getConversation(ride.id, user.id)
        console.log('Existing conversation:', conversation)
        
        if (conversation) {
          setConversationId(conversation.id)
        } else {
          // Create new conversation
          console.log('Creating new conversation...')
          const newConversation = await createConversation(ride.id, [user.id, ride.driver.id])
          console.log('New conversation:', newConversation)
          
          if (newConversation) {
            setConversationId(newConversation.id)
          } else {
            setError('Failed to create conversation')
          }
        }
      } catch (error) {
        console.error('Error initializing chat:', error)
        setError('Failed to initialize chat')
      } finally {
        setIsLoading(false)
      }
    }

    if (isOpen && ride) {
      initializeChat()
    }
  }, [isOpen, user, ride])

  // Add a function to create a test ride if needed
  const createTestRide = async () => {
    if (!user) return
    
    try {
      const { data: ride, error } = await supabase
        .from('rides')
        .insert([
          {
            driver_id: ride.driver.id,
            from_city: 'Test From',
            to_city: 'Test To',
            departure_time: new Date().toISOString(),
            price: 5000,
            seats_available: 4,
            car_model: 'Test Car',
            car_color: 'Black',
            car_year: '2024'
          }
        ])
        .select()
        .single()

      if (error) throw error
      console.log('Created test ride:', ride)
    } catch (error) {
      console.error('Error creating test ride:', error)
    }
  }

  if (!user) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign In Required</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Please sign in to chat with the driver.
            </p>
            <Button asChild>
              <a href="/auth">Sign In</a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src={ride?.driver?.image} alt={ride?.driver?.name} />
              <AvatarFallback>{ride?.driver?.name?.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{ride?.driver?.name}</DialogTitle>
              <div className="flex items-center text-sm text-muted-foreground">
                <Star className="h-3 w-3 fill-primary text-primary mr-1" />
                {ride?.driver?.rating} • {ride?.driver?.trips} trips
              </div>
            </div>
          </div>
        </DialogHeader>
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={createTestRide}>Create Test Ride</Button>
          </div>
        ) : conversationId ? (
          <ChatWindow conversationId={conversationId} />
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              Unable to start chat. Please try again later.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}