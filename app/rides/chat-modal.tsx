'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSupabase } from '@/providers/SupabaseProvider'
import { toast } from '@/components/ui/use-toast'
import { format } from 'date-fns'

interface Message {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  ride_id: string
  created_at: string
  sender?: {
    name: string
    avatar_url?: string
  }
}

interface RealtimePayload {
  new: Message
  old: Message | null
  errors: any[] | null
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
}

interface ChatModalProps {
  isOpen: boolean
  onClose: () => void
  rideId: string
  driverId: string
}

export function ChatModal({ isOpen, onClose, rideId, driverId }: ChatModalProps) {
  const { supabase, user } = useSupabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      loadMessages()
      // Subscribe to new messages
      const channel = supabase
        .channel(`chat:${rideId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `ride_id=eq.${rideId}`
          },
          (payload: RealtimePayload) => {
            const newMessage = payload.new
            setMessages(prev => [...prev, newMessage])
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isOpen, rideId, user])

  const loadMessages = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(name, avatar_url)
        `)
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load messages. Please try again."
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim()) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            sender_id: user.id,
            receiver_id: driverId,
            ride_id: rideId,
            content: newMessage.trim(),
            status: 'sent'
          }
        ])

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again."
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat with Driver</DialogTitle>
          <DialogDescription>
            Send messages to coordinate your ride. Do not share personal contact information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4">
          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-4 p-4 border rounded-md">
            {loading ? (
              <div className="text-center text-muted-foreground">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground">No messages yet</div>
            ) : (
              messages.map((message: Message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {message.sender?.name || 'Unknown'}
                    </div>
                    <div className="text-sm">{message.content}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {format(new Date(message.created_at), 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}