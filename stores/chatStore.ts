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
import { chatService } from "@/lib/services/chat-service";

interface UnreadCount {
  rideId: string;
  count: number;
}

interface ChatState {
  // Conversations state
  conversations: UIConversation[];
  conversationsLoading: boolean;
  conversationsError: string | null;

  // Messages state (per ride)
  messages: Record<string, Message[]>; // rideId -> messages[]
  messagesLoading: Record<string, boolean>;
  messagesError: Record<string, string | null>;

  // Unread counts state
  unreadCounts: UnreadCount[];
  unreadCountsLoading: boolean;
  unreadCountsError: string | null;

  // Active conversations and subscriptions
  activeConversations: Set<string>;
  subscribedRides: Set<string>;
  channels: Map<string, any>; // rideId -> channel

  // Actions for conversations
  fetchConversations: (userId: string) => Promise<void>;
  setConversationsLoading: (loading: boolean) => void;
  setConversationsError: (error: string | null) => void;
  clearConversations: () => void;

  // Actions for messages
  fetchMessages: (rideId: string) => Promise<void>;
  sendMessage: (messageData: CreateMessageRequest) => Promise<Message>;
  setMessagesLoading: (rideId: string, loading: boolean) => void;
  setMessagesError: (rideId: string, error: string | null) => void;
  clearMessages: (rideId: string) => void;

  // Actions for unread counts
  fetchUnreadCounts: (userId: string) => Promise<void>;
  markAsRead: (rideId: string, userId: string) => Promise<void>;
  updateUnreadCount: (rideId: string, count: number) => void;
  addUnreadCount: (rideId: string) => void;
  clearUnreadCount: (rideId: string) => void;

  // Real-time subscription actions
  subscribeToRide: (rideId: string) => void;
  unsubscribeFromRide: (rideId: string) => void;
  subscribeToUnreadUpdates: (userId: string) => void;
  unsubscribeFromUnreadUpdates: () => void;

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

      // Actions for conversations
      fetchConversations: async (userId: string) => {
        set({ conversationsLoading: true, conversationsError: null });

        try {
          const conversations = await chatService.getConversations(userId);
          
          // Merge with unread counts
          const conversationsWithUnreadCounts = conversations.map(conv => {
            const unreadCount = get().unreadCounts.find(uc => uc.rideId === conv.rideId)?.count || 0;
            return {
              ...conv,
              unreadCount,
            };
          });
          
          set({
            conversations: conversationsWithUnreadCounts,
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
      fetchMessages: async (rideId: string) => {
        set((state) => ({
          messagesLoading: { ...state.messagesLoading, [rideId]: true },
          messagesError: { ...state.messagesError, [rideId]: null },
        }));

        try {
          const messages = await chatService.getMessages(rideId);
          set((state) => ({
            messages: { ...state.messages, [rideId]: messages },
            messagesLoading: { ...state.messagesLoading, [rideId]: false },
            messagesError: { ...state.messagesError, [rideId]: null },
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch messages";
          set((state) => ({
            messagesLoading: { ...state.messagesLoading, [rideId]: false },
            messagesError: { ...state.messagesError, [rideId]: errorMessage },
          }));
        }
      },

      sendMessage: async (messageData: CreateMessageRequest) => {
        try {
          const newMessage = await chatService.sendMessage(messageData);
          
          // Add message to local state
          set((state) => {
            const rideId = messageData.conversation_id; // Assuming conversation_id maps to rideId
            const existingMessages = state.messages[rideId] || [];
            return {
              messages: {
                ...state.messages,
                [rideId]: [...existingMessages, newMessage],
              },
            };
          });

          return newMessage;
        } catch (error) {
          console.error("Error sending message:", error);
          throw error;
        }
      },

      setMessagesLoading: (rideId, loading) => {
        set((state) => ({
          messagesLoading: { ...state.messagesLoading, [rideId]: loading },
        }));
      },

      setMessagesError: (rideId, error) => {
        set((state) => ({
          messagesError: { ...state.messagesError, [rideId]: error },
        }));
      },

      clearMessages: (rideId) => {
        set((state) => {
          const newMessages = { ...state.messages };
          const newMessagesLoading = { ...state.messagesLoading };
          const newMessagesError = { ...state.messagesError };
          
          delete newMessages[rideId];
          delete newMessagesLoading[rideId];
          delete newMessagesError[rideId];

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
          const unreadCounts = await chatService.getUnreadCounts(userId);
          set({
            unreadCounts,
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

      markAsRead: async (rideId: string, userId: string) => {
        try {
          await chatService.markMessagesAsRead(rideId, userId);
          set((state) => {
            // Update unread counts
            const newUnreadCounts = state.unreadCounts.filter((count) => count.rideId !== rideId);
            
            // Update conversations to remove unread count
            const updatedConversations = state.conversations.map(conv => 
              conv.rideId === rideId ? { ...conv, unreadCount: 0 } : conv
            );
            
            return {
              unreadCounts: newUnreadCounts,
              conversations: updatedConversations,
            };
          });
        } catch (error) {
          console.error("Error marking messages as read:", error);
          throw error;
        }
      },

      updateUnreadCount: (rideId: string, count: number) => {
        set((state) => {
          const existingIndex = state.unreadCounts.findIndex(
            (item) => item.rideId === rideId
          );

          let newUnreadCounts;
          if (existingIndex >= 0) {
            // Update existing count
            newUnreadCounts = [...state.unreadCounts];
            newUnreadCounts[existingIndex] = { rideId, count };
          } else {
            // Add new count
            newUnreadCounts = [...state.unreadCounts, { rideId, count }];
          }

          // Update conversations with new unread count
          const updatedConversations = state.conversations.map(conv => 
            conv.rideId === rideId ? { ...conv, unreadCount: count } : conv
          );

          return { 
            unreadCounts: newUnreadCounts,
            conversations: updatedConversations,
          };
        });
      },

      addUnreadCount: (rideId: string) => {
        const { unreadCounts } = get();
        const existing = unreadCounts.find((item) => item.rideId === rideId);
        
        if (existing) {
          get().updateUnreadCount(rideId, existing.count + 1);
        } else {
          get().updateUnreadCount(rideId, 1);
        }
      },

      clearUnreadCount: (rideId: string) => {
        set((state) => ({
          unreadCounts: state.unreadCounts.filter((item) => item.rideId !== rideId),
        }));
      },

      // Real-time subscription actions
      subscribeToRide: (rideId: string) => {
        const { channels } = get();
        
        if (channels.has(rideId)) return; // Already subscribed

        const channel = chatService.subscribeToMessages(rideId, (message) => {
          // Add new message to local state
          set((state) => {
            const existingMessages = state.messages[rideId] || [];
            const exists = existingMessages.some((msg) => msg.id === message.id);
            
            if (exists) return state; // Don't add duplicates

            return {
              messages: {
                ...state.messages,
                [rideId]: [...existingMessages, message],
              },
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
          chatService.unsubscribe(channel);
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

        const channel = chatService.subscribeToUnreadUpdates(userId, (unreadCounts) => {
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
          chatService.unsubscribe(channel);
          set((state) => {
            const newChannels = new Map(state.channels);
            newChannels.delete('unread-updates');
            return { channels: newChannels };
          });
        }
      },

      // Utility actions
      getOrCreateConversation: async (conversationData: CreateConversationRequest) => {
        try {
          return await chatService.getOrCreateConversation(conversationData);
        } catch (error) {
          console.error("Error getting/creating conversation:", error);
          throw error;
        }
      },

      getRideMessages: async (rideId: string) => {
        try {
          return await chatService.getRideMessages(rideId);
        } catch (error) {
          console.error("Error fetching ride messages:", error);
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
