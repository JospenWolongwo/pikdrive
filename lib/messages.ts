import { supabase } from '@/lib/supabase'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  ride_id: string
  participants: string[]
  created_at: string
}

// Create a new conversation
export async function createConversation(
  rideId: string,
  participants: string[]
): Promise<Conversation | null> {
  // First check if a conversation already exists
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('ride_id', rideId)
      .contains('participants', participants)
      .maybeSingle()

    if (fetchError) {
      return null
    }

    if (existing) {
      return existing
    }

    // Create new conversation if none exists
    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          ride_id: rideId,
          participants,
        },
      ])
      .select()
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    return null
  }
}

// Get an existing conversation
export async function getConversation(
  rideId: string,
  userId: string
): Promise<Conversation | null> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('ride_id', rideId)
      .contains('participants', [userId])
      .maybeSingle()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    return null
  }
}

// Get messages for a conversation
export async function getMessages(
  conversationId: string
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      return []
    }

    return data || []
  } catch (error) {
    return []
  }
}

// Send a new message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<Message | null> {
  try {
    // Filter sensitive information
    const filteredContent = filterSensitiveInfo(content)

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id: conversationId,
          sender_id: senderId,
          content: filteredContent,
        },
      ])
      .select()
      .single()

    if (error) {
      return null
    }

    return data
  } catch (error) {
    return null
  }
}

// Subscribe to new messages in a conversation
export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
) {
  const channel = supabase.channel(`messages:${conversationId}`)
  
  const subscription = channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message)
      }
    )
    .subscribe()

  return subscription
}

// Helper function to filter sensitive information
function filterSensitiveInfo(text: string): string {
  // Filter phone numbers
  text = text.replace(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    '[PHONE NUMBER REMOVED]'
  )

  // Filter email addresses
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL REMOVED]'
  )

  // Filter URLs
  text = text.replace(
    /(https?:\/\/[^\s]+)/g,
    '[LINK REMOVED]'
  )

  // Filter social media handles
  text = text.replace(
    /(?:@[\w_]+|#[\w_]+)/g,
    '[SOCIAL MEDIA HANDLE REMOVED]'
  )

  return text
}
