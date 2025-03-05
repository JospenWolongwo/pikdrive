'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSupabase } from './SupabaseProvider'

interface UnreadCount {
  rideId: string
  count: number
}

interface ChatContextType {
  unreadCounts: UnreadCount[]
  markAsRead: (rideId: string) => Promise<void>
  subscribeToRide: (rideId: string) => void
  unsubscribeFromRide: (rideId: string) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useSupabase()
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([])
  const [subscribedRides, setSubscribedRides] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return

    // Load initial unread counts
    const loadUnreadCounts = async () => {
      try {
        // First get all unread messages
        const { data: messages, error } = await supabase
          .from('messages')
          .select('ride_id')
          .eq('receiver_id', user.id)
          .eq('read', false)

        if (error) throw error

        // Then count them by ride_id
        const counts = messages ? messages.reduce((acc: Record<string, number>, msg: { ride_id: string }) => {
          acc[msg.ride_id] = (acc[msg.ride_id] || 0) + 1
          return acc
        }, {} as Record<string, number>) : {}

        // Convert to our UnreadCount format
        setUnreadCounts(
          Object.entries(counts).map(([ride_id, count]): UnreadCount => ({
            rideId: ride_id,
            count: count as number
          }))
        )
      } catch (error) {
        console.error('Error loading unread counts:', error)
      }
    }

    loadUnreadCounts()
  }, [user, supabase])

  const markAsRead = async (rideId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('ride_id', rideId)
        .eq('receiver_id', user.id)
        .eq('read', false)

      if (error) throw error

      setUnreadCounts(prev =>
        prev.filter(count => count.rideId !== rideId)
      )
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const subscribeToRide = (rideId: string) => {
    if (subscribedRides.has(rideId)) return

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
        (payload: { new: { ride_id: string; receiver_id: string; read: boolean } }) => {
          const message = payload.new
          if (message.receiver_id === user?.id && !message.read) {
            setUnreadCounts(prev => {
              const existing = prev.find(c => c.rideId === rideId)
              if (existing) {
                return prev.map(c =>
                  c.rideId === rideId 
                    ? { ...c, count: c.count + 1 }
                    : c
                )
              }
              return [...prev, { rideId, count: 1 }]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `ride_id=eq.${rideId}`
        },
        (payload: { new: { ride_id: string; receiver_id: string; read: boolean } }) => {
          const message = payload.new
          if (message.receiver_id === user?.id && message.read) {
            setUnreadCounts(prev => 
              prev.filter(c => c.rideId !== rideId)
            )
          }
        }
      )
      .subscribe()

    setSubscribedRides(prev => new Set([...Array.from(prev), rideId]))

    return () => {
      channel.unsubscribe()
      setSubscribedRides(prev => {
        const next = new Set(prev)
        next.delete(rideId)
        return next
      })
    }
  }

  const unsubscribeFromRide = (rideId: string) => {
    if (!subscribedRides.has(rideId)) return

    supabase.channel(`chat:${rideId}`).unsubscribe()
    setSubscribedRides(prev => {
      const next = new Set(prev)
      next.delete(rideId)
      return next
    })
  }

  return (
    <ChatContext.Provider
      value={{
        unreadCounts,
        markAsRead,
        subscribeToRide,
        unsubscribeFromRide
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
