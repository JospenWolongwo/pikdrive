'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Message, getMessages, sendMessage, subscribeToMessages } from '@/lib/messages'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import { Send } from 'lucide-react'

interface ChatWindowProps {
  conversationId: string
  className?: string
}

export function ChatWindow({ conversationId, className }: ChatWindowProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    // Load initial messages
    const loadMessages = async () => {
      try {
        console.log('Loading messages for conversation:', conversationId)
        const initialMessages = await getMessages(conversationId)
        console.log('Loaded initial messages:', initialMessages)
        setMessages(initialMessages)
        scrollToBottom()
      } catch (error) {
        console.error('Error loading messages:', error)
        setError('Failed to load messages')
      }
    }

    // Subscribe to new messages
    console.log('Setting up message subscription for:', conversationId)
    const subscription = subscribeToMessages(conversationId, (message) => {
      console.log('Received new message:', message)
      setMessages((prev) => [...prev, message])
      scrollToBottom()
    })

    loadMessages()

    return () => {
      console.log('Cleaning up subscription')
      subscription.unsubscribe()
    }
  }, [conversationId])

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim()) return

    try {
      setIsLoading(true)
      setError(null)
      console.log('Sending message:', newMessage)
      
      const message = await sendMessage(conversationId, user.id, newMessage.trim())
      console.log('Message sent:', message)
      
      if (message) {
        setNewMessage('')
      } else {
        setError('Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <Button onClick={() => setError(null)}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-[600px] ${className}`}>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.sender_id === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src="/placeholder-avatar.svg" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div
                className={`group flex flex-col ${
                  message.sender_id === user?.id ? 'items-end' : ''
                }`}
              >
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    message.sender_id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.content}
                </div>
                <span className="text-xs text-muted-foreground px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="min-h-[80px]"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !newMessage.trim()}
            className="self-end"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send. Shift + Enter for new line.
          Contact information will be automatically removed.
        </p>
      </div>
    </div>
  )
}
