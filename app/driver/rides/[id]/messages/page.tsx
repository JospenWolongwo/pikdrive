"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/providers/SupabaseProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { MessageCircle, Send } from "lucide-react"
import { format } from "date-fns"
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

interface Message {
  id: string
  content: string
  created_at: string
  sender: {
    full_name: string
  }
}

interface DatabaseMessage {
  id: string
  content: string
  created_at: string
  ride_id: string
  sender_id: string
}

interface Ride {
  id: string
  from_city: string
  to_city: string
  departure_time: string
  messages: Message[]
}

interface RealtimePayload {
  new: DatabaseMessage
  old: DatabaseMessage | null
  eventType: "INSERT" | "UPDATE" | "DELETE"
}

export default function RideMessagesPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { supabase, user } = useSupabase()
  const [ride, setRide] = useState<Ride | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/auth")
      return
    }

    const loadRide = async () => {
      try {
        const { data, error } = await supabase
          .from("rides")
          .select(`
            id,
            from_city,
            to_city,
            departure_time,
            messages (
              id,
              content,
              created_at,
              sender:profiles (
                full_name
              )
            )
          `)
          .eq("id", params.id)
          .eq("driver_id", user.id)
          .single()

        if (error) throw error
        if (!data) {
          toast({
            title: "Ride not found",
            description: "The requested ride could not be found.",
            variant: "destructive",
          })
          router.push("/driver/dashboard")
          return
        }

        setRide(data)
      } catch (error) {
        console.error("Error loading ride:", error)
        toast({
          title: "Error",
          description: "There was an error loading the ride messages.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadRide()

    // Subscribe to new messages
    const channel = supabase
      .channel(`ride:${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `ride_id=eq.${params.id}`,
        },
        async (payload: RealtimePayload) => {
          // Fetch the sender's information
          const { data: senderData, error: senderError } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", payload.new.sender_id)
            .single()

          if (senderError) {
            console.error("Error fetching sender info:", senderError)
            return
          }

          const newMessage: Message = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            sender: {
              full_name: senderData.full_name,
            },
          }

          setRide((currentRide) => {
            if (!currentRide) return null
            return {
              ...currentRide,
              messages: [...currentRide.messages, newMessage],
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, router, supabase, params.id])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !ride || !newMessage.trim()) return

    try {
      setSending(true)

      const { error } = await supabase.from("messages").insert({
        ride_id: ride.id,
        sender_id: user.id,
        content: newMessage.trim(),
      })

      if (error) throw error

      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        title: "Error",
        description: "There was an error sending your message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="container py-10">
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!ride) return null

  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-muted-foreground mt-1">
              {ride.from_city} to {ride.to_city} -{" "}
              {format(new Date(ride.departure_time), "PPP p")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/driver/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="space-y-4">
              {ride.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="mx-auto h-8 w-8 mb-2" />
                  <p>No messages yet</p>
                </div>
              ) : (
                ride.messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-2 p-3 rounded-lg bg-muted"
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
                ))
              )}
            </div>

            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}
