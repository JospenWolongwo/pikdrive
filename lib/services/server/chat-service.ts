import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  Message, 
  Conversation, 
  ConversationWithParticipants,
  CreateMessageRequest,
  CreateConversationRequest,
  RideMessage,
  RideConversationSummary 
} from '@/types';

/**
 * Server-side ChatService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 */
export class ServerChatService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get messages for a specific ride
   */
  async getMessages(rideId: string): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
      `)
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Send a new message
   */
  async sendMessage(messageData: CreateMessageRequest, senderId: string): Promise<Message> {
    // First, get the conversation to extract ride_id
    const { data: conversation, error: convError } = await this.supabase
      .from('conversations')
      .select('ride_id')
      .eq('id', messageData.conversation_id)
      .single();

    if (convError) {
      throw new Error(`Failed to fetch conversation: ${convError.message}`);
    }

    const { data, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: messageData.conversation_id,
        sender_id: senderId,
        content: messageData.content,
        ride_id: conversation.ride_id,
      })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    // Update conversation's last_message_at
    await this.supabase
      .from('conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageData.conversation_id);

    return data;
  }

  /**
   * Get conversations for a user
   */
  async getConversations(userId: string): Promise<ConversationWithParticipants[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select(`
        *,
        driver:profiles!conversations_driver_id_fkey(id, full_name, avatar_url, phone),
        passenger:profiles!conversations_passenger_id_fkey(id, full_name, avatar_url, phone),
        ride:rides(id, from_city, to_city, departure_time),
        last_message:messages(id, content, created_at)
      `)
      .or(`driver_id.eq.${userId},passenger_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create or get existing conversation
   */
  async getOrCreateConversation(conversationData: CreateConversationRequest): Promise<Conversation> {
    // Check if conversation already exists
    const { data: existing, error: existingError } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('ride_id', conversationData.ride_id)
      .eq('driver_id', conversationData.driver_id)
      .eq('passenger_id', conversationData.passenger_id)
      .single();

    if (existing) {
      return existing;
    }

    // Create new conversation
    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        ride_id: conversationData.ride_id,
        driver_id: conversationData.driver_id,
        passenger_id: conversationData.passenger_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(rideId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('messages')
      .update({ read: true })
      .eq('ride_id', rideId)
      .eq('receiver_id', userId)
      .eq('read', false);

    if (error) {
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  /**
   * Get unread message counts for a user
   */
  async getUnreadCounts(userId: string): Promise<{ rideId: string; count: number }[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('ride_id')
      .eq('receiver_id', userId)
      .eq('read', false);

    if (error) {
      throw new Error(`Failed to fetch unread counts: ${error.message}`);
    }

    // Group by ride_id and count
    const counts = (data || []).reduce((acc: any, msg: any) => {
      acc[msg.ride_id] = (acc[msg.ride_id] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([rideId, count]) => ({
      rideId,
      count: count as number,
    }));
  }

  /**
   * Get ride messages for driver dashboard
   */
  async getRideMessages(rideId: string): Promise<RideConversationSummary[]> {
    // Get all conversations for this ride
    const { data: conversations, error: convError } = await this.supabase
      .from('conversations')
      .select(`
        id,
        passenger_id,
        passenger:profiles!conversations_passenger_id_fkey(id, full_name, avatar_url)
      `)
      .eq('ride_id', rideId);

    if (convError) {
      throw new Error(`Failed to fetch conversations: ${convError.message}`);
    }

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Get last message for each conversation
    const conversationIds = conversations.map((c: any) => c.id);
    
    const { data: messages, error: msgError } = await this.supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    if (msgError) {
      throw new Error(`Failed to fetch messages: ${msgError.message}`);
    }

    // Group messages by conversation and get last message
    const lastMessages = new Map();
    (messages || []).forEach((msg: any) => {
      if (!lastMessages.has(msg.conversation_id)) {
        lastMessages.set(msg.conversation_id, msg);
      }
    });

    // Combine conversation and message data
    const rideMessages: RideConversationSummary[] = conversations.map((conv: any) => {
      const lastMessage = lastMessages.get(conv.id);
      
      return {
        conversationId: conv.id,
        passengerId: conv.passenger_id,
        passengerName: conv.passenger.full_name,
        passengerAvatar: conv.passenger.avatar_url,
        lastMessage: lastMessage?.content || 'No messages yet',
        lastMessageTime: lastMessage?.created_at || conv.created_at,
        unreadCount: 0, // Would need separate query for this
      };
    });

    return rideMessages;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // Delete all messages first
    const { error: messagesError } = await this.supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      throw new Error(`Failed to delete messages: ${messagesError.message}`);
    }

    // Delete conversation
    const { error } = await this.supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }
  }
}
