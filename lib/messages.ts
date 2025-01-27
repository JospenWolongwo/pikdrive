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
  console.log('Creating conversation with:', { rideId, participants })

  // First check if a conversation already exists
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('ride_id', rideId)
      .contains('participants', participants)
      .maybeSingle()

    if (fetchError) {
      console.error('Error checking existing conversation:', fetchError)
      return null
    }

    if (existing) {
      console.log('Found existing conversation:', existing)
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
      console.error('Error creating conversation:', error)
      return null
    }

    console.log('Created new conversation:', data)
    return data
  } catch (error) {
    console.error('Exception in createConversation:', error)
    return null
  }
}

// Get an existing conversation
export async function getConversation(
  rideId: string,
  userId: string
): Promise<Conversation | null> {
  console.log('Getting conversation for:', { rideId, userId })

  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('ride_id', rideId)
      .contains('participants', [userId])
      .maybeSingle()

    if (error) {
      console.error('Error getting conversation:', error)
      return null
    }

    console.log('Found conversation:', data)
    return data
  } catch (error) {
    console.error('Exception in getConversation:', error)
    return null
  }
}

// Get messages for a conversation
export async function getMessages(
  conversationId: string
): Promise<Message[]> {
  console.log('Getting messages for conversation:', conversationId)

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error getting messages:', error)
      return []
    }

    console.log('Found messages:', data)
    return data || []
  } catch (error) {
    console.error('Exception in getMessages:', error)
    return []
  }
}

// Send a new message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<Message | null> {
  console.log('Sending message:', { conversationId, senderId, content })

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
      console.error('Error sending message:', error)
      return null
    }

    console.log('Sent message:', data)
    return data
  } catch (error) {
    console.error('Exception in sendMessage:', error)
    return null
  }
}

// Subscribe to new messages in a conversation
export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
) {
  console.log('Subscribing to messages for conversation:', conversationId)

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
        console.log('New message received:', payload)
        callback(payload.new as Message)
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status)
    })

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
