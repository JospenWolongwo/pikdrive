import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { 
  Message, 
  Conversation, 
  ConversationWithParticipants,
  UIConversation,
  CreateMessageRequest,
  CreateConversationRequest,
  RideMessage
} from "@/types";
import { chatApiClient } from "@/lib/api-client/chat";
import { supabase } from "@/lib/supabase/client";

// Helper function to sort conversations by latest message time
const sortConversationsByLatest = (conversations: UIConversation[]): UIConversation[] => {
  return [...conversations].sort((a, b) => {
    const timeA = new Date(a.lastMessageTime).getTime();
    const timeB = new Date(b.lastMessageTime).getTime();
    return timeB - timeA; // Descending order (newest first)
  });
};

interface UnreadCount {
  conversationId: string;
  count: number;
}

interface ChatState {
  // Conversations state
  conversations: UIConversation[];
  conversationsLoading: boolean;
  conversationsError: string | null;

  // Messages state (per conversation)
  messages: Record<string, Message[]>; // conversationId -> messages[]
  messagesLoading: Record<string, boolean>; // conversationId -> loading
  messagesError: Record<string, string | null>; // conversationId -> error

  // Unread counts state
  unreadCounts: UnreadCount[];
  unreadCountsLoading: boolean;
  unreadCountsError: string | null;

  // Active conversations and subscriptions
  activeConversations: Set<string>;
  subscribedRides: Set<string>;
  channels: Map<string, any>; // rideId -> channel
  globalChannel: any | null; // Global subscription channel

  // Actions for conversations
  fetchConversations: (userId: string) => Promise<void>;
  setConversationsLoading: (loading: boolean) => void;
  setConversationsError: (error: string | null) => void;
  clearConversations: () => void;

  // Actions for messages
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (messageData: CreateMessageRequest) => Promise<Message>;
  setMessagesLoading: (conversationId: string, loading: boolean) => void;
  setMessagesError: (conversationId: string, error: string | null) => void;
  clearMessages: (conversationId: string) => void;

  // Actions for unread counts
  fetchUnreadCounts: (userId: string) => Promise<void>;
  markAsRead: (conversationId: string, userId: string) => Promise<void>;
  updateUnreadCount: (conversationId: string, count: number) => void;
  addUnreadCount: (conversationId: string) => void;
  clearUnreadCount: (conversationId: string) => void;

  // Real-time subscription actions
  subscribeToRide: (rideId: string) => void;
  unsubscribeFromRide: (rideId: string) => void;
  subscribeToUnreadUpdates: (userId: string) => void;
  unsubscribeFromUnreadUpdates: () => void;
  subscribeToAllConversations: (userId: string) => void;
  unsubscribeFromAllConversations: () => void;

  // Utility actions
  getOrCreateConversation: (conversationData: CreateConversationRequest) => Promise<Conversation>;
  getRideMessages: (rideId: string) => Promise<RideMessage[]>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      conversationsLoading: false,
      conversationsError: null,

      messages: {},
      messagesLoading: {},
      messagesError: {},

      unreadCounts: [],
      unreadCountsLoading: false,
      unreadCountsError: null,

      activeConversations: new Set(),
      subscribedRides: new Set(),
      channels: new Map(),
      globalChannel: null,

      // Actions for conversations
      fetchConversations: async (userId: string) => {
        set({ conversationsLoading: true, conversationsError: null });

        try {
          const response = await chatApiClient.getConversations(userId);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch conversations');
          }
          
          const conversationsData = response.data || [];
          
          // Transform to UI format
          const uiConversations: UIConversation[] = conversationsData.map((conv): UIConversation => {
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
          
          // Merge with unread counts
          const conversationsWithUnreadCounts = uiConversations.map(conv => {
            const unreadCount = get().unreadCounts.find(uc => uc.conversationId === conv.id)?.count || 0;
            return {
              ...conv,
              unreadCount,
            };
          });
          
          // Sort by lastMessageTime (newest first)
          const sortedConversations = sortConversationsByLatest(conversationsWithUnreadCounts);
          
          set({
            conversations: sortedConversations,
            conversationsLoading: false,
            conversationsError: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch conversations";
          set({
            conversationsLoading: false,
            conversationsError: errorMessage,
          });
        }
      },

      setConversationsLoading: (loading) => {
        set({ conversationsLoading: loading });
      },

      setConversationsError: (error) => {
        set({ conversationsError: error });
      },

      clearConversations: () => {
        set({
          conversations: [],
          conversationsError: null,
        });
      },

      // Actions for messages
      fetchMessages: async (conversationId: string) => {
        set((state) => ({
          messagesLoading: { ...state.messagesLoading, [conversationId]: true },
          messagesError: { ...state.messagesError, [conversationId]: null },
        }));

        try {
          // Get rideId from conversation to call API
          const conversation = get().conversations.find(c => c.id === conversationId);
          if (!conversation) {
            throw new Error('Conversation not found');
          }
          
          const response = await chatApiClient.getMessages(conversation.rideId);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch messages');
          }
          
          // Filter messages for THIS conversation only
          const conversationMessages = (response.data || []).filter(
            msg => msg.conversation_id === conversationId
          );
          
          set((state) => ({
            messages: { ...state.messages, [conversationId]: conversationMessages },
            messagesLoading: { ...state.messagesLoading, [conversationId]: false },
            messagesError: { ...state.messagesError, [conversationId]: null },
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch messages";
          set((state) => ({
            messagesLoading: { ...state.messagesLoading, [conversationId]: false },
            messagesError: { ...state.messagesError, [conversationId]: errorMessage },
          }));
        }
      },

      sendMessage: async (messageData: CreateMessageRequest) => {
        try {
          const response = await chatApiClient.sendMessage(messageData);
          
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to send message');
          }
          
          const newMessage = response.data;
          
          // Get conversationId from the response
          const conversationId = newMessage.conversation_id;
          
          // Update local state
          set((state) => {
            const existingMessages = state.messages[conversationId] || [];
            const updatedMessages = [...existingMessages, newMessage];
            
            // Update conversation's last_message and move to top
            // Match by conversation_id for exact conversation, not rideId
            const updatedConversations = state.conversations.map(conv => {
              if (conv.id === conversationId) {
                return {
                  ...conv,
                  lastMessage: newMessage.content,
                  lastMessageTime: newMessage.created_at,
                  updated_at: newMessage.created_at,
                };
              }
              return conv;
            });
            
            // Move the updated conversation to the top and sort
            const updatedConv = updatedConversations.find(conv => conv.id === conversationId);
            const otherConvs = updatedConversations.filter(conv => conv.id !== conversationId);
            const reorderedConversations = updatedConv ? [updatedConv, ...otherConvs] : updatedConversations;
            
            // Apply full sort by lastMessageTime
            const sortedConversations = sortConversationsByLatest(reorderedConversations);
            
            return {
              messages: {
                ...state.messages,
                [conversationId]: updatedMessages,
              },
              conversations: sortedConversations,
            };
          });

          return newMessage;
        } catch (error) {
          throw error;
        }
      },

      setMessagesLoading: (conversationId, loading) => {
        set((state) => ({
          messagesLoading: { ...state.messagesLoading, [conversationId]: loading },
        }));
      },

      setMessagesError: (conversationId, error) => {
        set((state) => ({
          messagesError: { ...state.messagesError, [conversationId]: error },
        }));
      },

      clearMessages: (conversationId) => {
        set((state) => {
          const newMessages = { ...state.messages };
          const newMessagesLoading = { ...state.messagesLoading };
          const newMessagesError = { ...state.messagesError };
          
          delete newMessages[conversationId];
          delete newMessagesLoading[conversationId];
          delete newMessagesError[conversationId];

          return {
            messages: newMessages,
            messagesLoading: newMessagesLoading,
            messagesError: newMessagesError,
          };
        });
      },

      // Actions for unread counts
      fetchUnreadCounts: async (userId: string) => {
        set({ unreadCountsLoading: true, unreadCountsError: null });

        try {
          const response = await chatApiClient.getUnreadCounts(userId);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch unread counts');
          }
          
          set({
            unreadCounts: response.data || [],
            unreadCountsLoading: false,
            unreadCountsError: null,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch unread counts";
          set({
            unreadCountsLoading: false,
            unreadCountsError: errorMessage,
          });
        }
      },

      markAsRead: async (conversationId: string, userId: string) => {
        try {
          // Get rideId from conversation for API call
          const conversation = get().conversations.find(c => c.id === conversationId);
          if (!conversation) {
            return;
          }
          
          await chatApiClient.markMessagesAsRead(conversation.rideId, userId);
          set((state) => {
            // Update unread counts
            const newUnreadCounts = state.unreadCounts.filter((count) => count.conversationId !== conversationId);
            
            // Update conversations to remove unread count
            const updatedConversations = state.conversations.map(conv => 
              conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
            );
            
            return {
              unreadCounts: newUnreadCounts,
              conversations: updatedConversations,
            };
          });
        } catch (error) {
          throw error;
        }
      },

      updateUnreadCount: (conversationId: string, count: number) => {
        set((state) => {
          const existingIndex = state.unreadCounts.findIndex(
            (item) => item.conversationId === conversationId
          );

          let newUnreadCounts;
          if (existingIndex >= 0) {
            // Update existing count
            newUnreadCounts = [...state.unreadCounts];
            newUnreadCounts[existingIndex] = { conversationId, count };
          } else {
            // Add new count
            newUnreadCounts = [...state.unreadCounts, { conversationId, count }];
          }

          // Update conversations with new unread count
          const updatedConversations = state.conversations.map(conv => 
            conv.id === conversationId ? { ...conv, unreadCount: count } : conv
          );

          return { 
            unreadCounts: newUnreadCounts,
            conversations: updatedConversations,
          };
        });
      },

      addUnreadCount: (conversationId: string) => {
        const { unreadCounts } = get();
        const existing = unreadCounts.find((item) => item.conversationId === conversationId);
        
        if (existing) {
          get().updateUnreadCount(conversationId, existing.count + 1);
        } else {
          get().updateUnreadCount(conversationId, 1);
        }
      },

      clearUnreadCount: (conversationId: string) => {
        set((state) => ({
          unreadCounts: state.unreadCounts.filter((item) => item.conversationId !== conversationId),
        }));
      },

      // Real-time subscription actions
      subscribeToRide: (rideId: string) => {
        const { channels } = get();
        
        if (channels.has(rideId)) {
          return; // Already subscribed
        }

        const channel = chatApiClient.subscribeToMessages(supabase, rideId, (message) => {
          // Add new message to local state and update conversation
          set((state) => {
            const conversationId = message.conversation_id;
            const existingMessages = state.messages[conversationId] || [];
            const exists = existingMessages.some((msg) => msg.id === message.id);
            
            if (exists) return state; // Don't add duplicates

            const updatedMessages = [...existingMessages, message];
            
            // Update conversation's last_message and move to top
            // Match by conversation_id for exact conversation, not rideId
            const updatedConversations = state.conversations.map(conv => {
              if (conv.id === conversationId) {
                return {
                  ...conv,
                  lastMessage: message.content,
                  lastMessageTime: message.created_at,
                  updated_at: message.created_at,
                };
              }
              return conv;
            });
            
            // Move the updated conversation to the top and sort
            const updatedConv = updatedConversations.find(conv => conv.id === conversationId);
            const otherConvs = updatedConversations.filter(conv => conv.id !== conversationId);
            const reorderedConversations = updatedConv ? [updatedConv, ...otherConvs] : updatedConversations;
            
            // Apply full sort by lastMessageTime
            const sortedConversations = sortConversationsByLatest(reorderedConversations);

            return {
              messages: {
                ...state.messages,
                [conversationId]: updatedMessages,
              },
              conversations: sortedConversations,
            };
          });

          // Update unread count if message is not from current user
          // Note: You'll need to get current user ID from auth store
          // get().addUnreadCount(rideId);
        });

        set((state) => ({
          channels: new Map([...state.channels, [rideId, channel]]),
          subscribedRides: new Set([...state.subscribedRides, rideId]),
        }));
      },

      unsubscribeFromRide: (rideId: string) => {
        const { channels } = get();
        const channel = channels.get(rideId);
        
        if (channel) {
          chatApiClient.unsubscribe(supabase, channel);
          set((state) => {
            const newChannels = new Map(state.channels);
            newChannels.delete(rideId);
            
            const newSubscribedRides = new Set(state.subscribedRides);
            newSubscribedRides.delete(rideId);

            return {
              channels: newChannels,
              subscribedRides: newSubscribedRides,
            };
          });
        }
      },

      subscribeToUnreadUpdates: (userId: string) => {
        const { channels } = get();
        
        if (channels.has('unread-updates')) return; // Already subscribed

        const channel = chatApiClient.subscribeToUnreadUpdates(supabase, userId, (unreadCounts) => {
          set({ unreadCounts });
        });

        set((state) => ({
          channels: new Map([...state.channels, ['unread-updates', channel]]),
        }));
      },

      unsubscribeFromUnreadUpdates: () => {
        const { channels } = get();
        const channel = channels.get('unread-updates');
        
        if (channel) {
          chatApiClient.unsubscribe(supabase, channel);
          set((state) => {
            const newChannels = new Map(state.channels);
            newChannels.delete('unread-updates');
            return { channels: newChannels };
          });
        }
      },

      subscribeToAllConversations: (userId: string) => {
        const { globalChannel } = get();
        
        if (globalChannel) return; // Already subscribed
        
        const channel = supabase
          .channel(`user-conversations:${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            (payload) => {
              const message = payload.new;
              
              // Update conversation in store immediately (no async database call)
              set((state) => {
                // Check if conversation exists in local state
                const conversationExists = state.conversations.some(
                  conv => conv.id === message.conversation_id
                );
                
                if (!conversationExists) {
                  return state; // Return unchanged state
                }
                
                // Find the conversation in local state
                const conversation = state.conversations.find(
                  conv => conv.id === message.conversation_id
                );
                
                if (!conversation) return state;
                
                // Update conversation with new message data
                const updatedConversations = state.conversations.map(conv => {
                  if (conv.id === message.conversation_id) {
                    const newUnreadCount = message.sender_id !== userId 
                      ? (conv.unreadCount || 0) + 1 
                      : conv.unreadCount;
                    
                    return {
                      ...conv,
                      lastMessage: message.content,
                      lastMessageTime: message.created_at,
                      unreadCount: newUnreadCount,
                    };
                  }
                  return conv;
                });
                
                // Sync unreadCounts array with conversation unreadCount
                const updatedUnreadCounts = updatedConversations
                  .filter(conv => conv.unreadCount > 0)
                  .map(conv => ({
                    conversationId: conv.id,
                    count: conv.unreadCount
                  }));
                
                return {
                  conversations: sortConversationsByLatest(updatedConversations),
                  unreadCounts: updatedUnreadCounts,
                };
              });
            }
          )
          .subscribe();
        
        set({ globalChannel: channel });
      },

      unsubscribeFromAllConversations: () => {
        const { globalChannel } = get();
        
        if (globalChannel) {
          supabase.removeChannel(globalChannel);
          set({ globalChannel: null });
        }
      },

      // Utility actions
      getOrCreateConversation: async (conversationData: CreateConversationRequest) => {
        try {
          const response = await chatApiClient.getOrCreateConversation(conversationData);
          
          if (!response.success || !response.data) {
            throw new Error(response.error || 'Failed to get/create conversation');
          }
          
          return response.data;
        } catch (error) {
          throw error;
        }
      },

      getRideMessages: async (rideId: string) => {
        try {
          const response = await chatApiClient.getRideMessages(rideId);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to fetch ride messages');
          }
          
          return response.data || [];
        } catch (error) {
          throw error;
        }
      },
    }),
    {
      name: 'chat-storage',
      // Only persist data, not loading states or channels
      partialize: (state) => ({
        conversations: state.conversations,
        messages: state.messages,
        unreadCounts: state.unreadCounts,
      }),
    }
  )
);
