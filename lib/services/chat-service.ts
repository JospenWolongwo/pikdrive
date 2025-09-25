import { apiClient } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";
import type { 
  Message, 
  Conversation, 
  ConversationWithParticipants,
  UIConversation,
  CreateMessageRequest,
  CreateConversationRequest,
  RideMessage,
  ApiResponse,
  PaginatedResponse 
} from "@/types";

/**
 * Service for chat/messaging API calls using the centralized apiClient
 */
export class ChatService {
  /**
   * Get messages for a specific ride
   */
  async getMessages(rideId: string): Promise<Message[]> {
    try {
      const response = await apiClient.get<ApiResponse<Message[]>>(`/api/messages/ride/${rideId}`);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch messages");
      }

      return response.data || [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  /**
   * Send a new message
   */
  async sendMessage(messageData: CreateMessageRequest): Promise<Message> {
    try {
      const response = await apiClient.post<ApiResponse<Message>>("/api/messages", messageData);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to send message");
      }

      return response.data;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Get conversations for a user (transformed to UI format)
   */
  async getConversations(userId: string): Promise<UIConversation[]> {
    try {
      const response = await apiClient.get<ApiResponse<ConversationWithParticipants[]>>(`/api/conversations/user/${userId}`);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch conversations");
      }

      // Transform the data to UI format
      const conversations = (response.data || []).map((conv): UIConversation => {
        // Determine the other user (not the current user)
        const otherUser = conv.driver.id === userId ? conv.passenger : conv.driver;
        
        return {
          id: conv.id,
          rideId: conv.ride_id,
          otherUserId: otherUser.id,
          otherUserName: otherUser.full_name,
          otherUserAvatar: otherUser.avatar_url || undefined,
          lastMessage: conv.last_message?.content || "No messages yet",
          lastMessageTime: conv.last_message?.created_at || conv.created_at,
          unreadCount: 0, // Will be updated by unread counts
          ride: {
            from_city: conv.ride?.from_city || "",
            to_city: conv.ride?.to_city || "",
            departure_time: conv.ride?.departure_time || "",
          },
        };
      });

      return conversations;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      throw error;
    }
  }

  /**
   * Create or get conversation for a ride
   */
  async getOrCreateConversation(conversationData: CreateConversationRequest): Promise<Conversation> {
    try {
      const response = await apiClient.post<ApiResponse<Conversation>>("/api/conversations", conversationData);

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to create/get conversation");
      }

      return response.data;
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  /**
   * Mark messages as read for a specific ride
   */
  async markMessagesAsRead(rideId: string, userId: string): Promise<void> {
    try {
      const response = await apiClient.put<ApiResponse<void>>(`/api/messages/read/${rideId}`, { userId });

      if (!response.success) {
        throw new Error(response.error || "Failed to mark messages as read");
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  /**
   * Get unread message counts for user
   */
  async getUnreadCounts(userId: string): Promise<{ rideId: string; count: number }[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ rideId: string; count: number }[]>>(`/api/messages/unread/${userId}`);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch unread counts");
      }

      return response.data || [];
    } catch (error) {
      console.error("Error fetching unread counts:", error);
      throw error;
    }
  }

  /**
   * Get ride messages for driver dashboard
   */
  async getRideMessages(rideId: string): Promise<RideMessage[]> {
    try {
      const response = await apiClient.get<ApiResponse<RideMessage[]>>(`/api/messages/ride/${rideId}/dashboard`);
      
      if (!response.success) {
        throw new Error(response.error || "Failed to fetch ride messages");
      }

      return response.data || [];
    } catch (error) {
      console.error("Error fetching ride messages:", error);
      throw error;
    }
  }

  /**
   * Subscribe to new messages for a ride (real-time)
   */
  subscribeToMessages(rideId: string, callback: (message: Message) => void) {
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
        async (payload) => {
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
  subscribeToUnreadUpdates(userId: string, callback: (unreadCounts: { rideId: string; count: number }[]) => void) {
    const channel = supabase
      .channel(`unread-updates:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Only trigger if message is for this user and unread
          if (newMessage.receiver_id === userId && !newMessage.read) {
            // Fetch updated unread counts
            const unreadCounts = await this.getUnreadCounts(userId);
            callback(unreadCounts);
          }
        }
      )
      .subscribe();

    return channel;
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  }
}

/**
 * Default instance of the chat service
 */
export const chatService = new ChatService();

