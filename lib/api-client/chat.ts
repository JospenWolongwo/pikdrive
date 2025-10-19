import { apiClient } from './index';
import type { 
  Message, 
  Conversation, 
  ConversationWithParticipants,
  UIConversation,
  CreateMessageRequest,
  CreateConversationRequest,
  RideMessage,
  ApiResponse 
} from '@/types';

/**
 * Chat API client methods
 */
export class ChatApiClient {
  /**
   * Get messages for a specific ride
   */
  async getMessages(rideId: string): Promise<ApiResponse<Message[]>> {
    return apiClient.get<ApiResponse<Message[]>>(`/api/messages/ride/${rideId}`);
  }

  /**
   * Send a new message
   */
  async sendMessage(messageData: CreateMessageRequest): Promise<ApiResponse<Message>> {
    return apiClient.post<ApiResponse<Message>>("/api/messages", messageData);
  }

  /**
   * Get conversations for a user (transformed to UI format)
   */
  async getConversations(userId: string): Promise<ApiResponse<ConversationWithParticipants[]>> {
    return apiClient.get<ApiResponse<ConversationWithParticipants[]>>(`/api/conversations/user/${userId}`);
  }

  /**
   * Create or get conversation for a ride
   */
  async getOrCreateConversation(conversationData: CreateConversationRequest): Promise<ApiResponse<Conversation>> {
    return apiClient.post<ApiResponse<Conversation>>("/api/conversations", conversationData);
  }

  /**
   * Mark messages as read for a specific ride
   */
  async markMessagesAsRead(rideId: string, userId: string): Promise<ApiResponse<void>> {
    return apiClient.post<ApiResponse<void>>(`/api/messages/read/${rideId}`, { userId });
  }

  /**
   * Get unread message counts for user
   */
  async getUnreadCounts(userId: string): Promise<ApiResponse<{ conversationId: string; count: number }[]>> {
    return apiClient.get<ApiResponse<{ conversationId: string; count: number }[]>>(`/api/messages/unread/${userId}`);
  }

  /**
   * Get ride messages for driver dashboard
   */
  async getRideMessages(rideId: string): Promise<ApiResponse<RideMessage[]>> {
    return apiClient.get<ApiResponse<RideMessage[]>>(`/api/messages/ride/${rideId}/dashboard`);
  }

  /**
   * Subscribe to new messages for a ride (real-time)
   * Note: This uses Supabase directly for real-time subscriptions
   */
  subscribeToMessages(supabase: any, rideId: string, callback: (message: Message) => void) {
    const channel = supabase
      .channel(`messages:${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `ride_id=eq.${rideId}`,
        },
        async (payload: any) => {
          const newMessage = payload.new as any;
          
          // Fetch sender information for the new message
          const { data: senderData } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", newMessage.sender_id)
            .single();

          const message: Message = {
            ...newMessage,
            sender: senderData || { full_name: "Unknown", avatar_url: null },
          };

          callback(message);
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Subscribe to unread message updates (real-time)
   */
  subscribeToUnreadUpdates(supabase: any, userId: string, callback: (unreadCounts: { conversationId: string; count: number }[]) => void) {
    const channel = supabase
      .channel(`unread-updates:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload: any) => {
          const newMessage = payload.new as any;
          
          // Only trigger if message is for this user and unread
          if (newMessage.receiver_id === userId && !newMessage.read) {
            // Fetch updated unread counts
            const response = await this.getUnreadCounts(userId);
            if (response.success && response.data) {
              callback(response.data);
            }
          }
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(supabase: any, channel: any) {
    supabase.removeChannel(channel);
  }
}

// Export singleton instance
export const chatApiClient = new ChatApiClient();
