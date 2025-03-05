'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSupabase } from '@/providers/SupabaseProvider'
import { toast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Message {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  ride_id: string
  created_at: string
  sender?: {
    full_name: string
    avatar_url?: string
  }
}

interface ChatDialogProps {
  isOpen: boolean
  onClose: () => void
  rideId: string
  otherUserId: string
  otherUserName: string
  otherUserAvatar?: string
}

export function ChatDialog({ 
  isOpen, 
  onClose, 
  rideId, 
  otherUserId,
  otherUserName,
  otherUserAvatar 
}: ChatDialogProps) {
  const { supabase, user } = useSupabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

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
          (payload: { new: Record<string, any> }) => {
            const newMessage = payload.new as Message
            setMessages(prev => [...prev, newMessage])
            scrollToBottom()
          }
        )
        .subscribe()

      return () => {
        channel.unsubscribe()
      }
    }
  }, [isOpen, user, rideId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error loading messages:', error)
      toast({
        variant: "destructive",
        title: "Error loading messages",
        description: "Please try again later."
      })
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return

    const messageContent = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            content: messageContent,
            sender_id: user.id,
            receiver_id: otherUserId,
            ride_id: rideId
          }
        ])
        .select('*, sender:profiles!messages_sender_id_fkey (full_name, avatar_url)')
        .single()

      if (error) throw error

      // Optimistically add the message
      if (data) {
        setMessages(prev => [...prev, data])
        scrollToBottom()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setNewMessage(messageContent) // Restore message if failed
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: "Please try again later."
      })
    }
  }

  useEffect(() => {
    if (isOpen && user) {
      const markAsRead = async () => {
        try {
          await supabase
            .from('messages')
            .update({ read: true })
            .eq('ride_id', rideId)
            .eq('receiver_id', user.id)
            .eq('read', false)
        } catch (error) {
          console.error('Error marking messages as read:', error)
        }
      }
      markAsRead()
    }
  }, [isOpen, user, rideId, supabase])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={otherUserAvatar} />
              <AvatarFallback>{otherUserName[0]}</AvatarFallback>
            </Avatar>
            <DialogTitle>{otherUserName}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pr-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`flex gap-2 max-w-[80%] ${
                    message.sender_id === user?.id ? 'flex-row-reverse' : ''
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.sender?.avatar_url} />
                    <AvatarFallback>
                      {message.sender?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      message.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {format(new Date(message.created_at), 'p')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t mt-auto">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="resize-none"
              rows={1}
            />
            <Button 
              onClick={sendMessage} 
              size="icon"
              disabled={!newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
