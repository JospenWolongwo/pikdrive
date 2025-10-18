"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useSupabase } from "./SupabaseProvider";

interface UnreadCount {
  rideId: string;
  count: number;
}

interface ChatContextType {
  unreadCounts: UnreadCount[];
  markAsRead: (rideId: string) => Promise<void>;
  subscribeToRide: (rideId: string) => void;
  unsubscribeFromRide: (rideId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { supabase, user } = useSupabase();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([]);
  const [subscribedRides, setSubscribedRides] = useState<Set<string>>(
    new Set()
  );
  const channelsRef = useRef<Map<string, any>>(new Map());
  const initializedRef = useRef(false);

  const loadUnreadCounts = useCallback(async () => {
    if (!user || initializedRef.current) return;

    try {
      initializedRef.current = true;
      // First get all unread messages by conversation (not sent by current user)
      const { data: messages, error } = await supabase
        .from("messages")
        .select("conversation_id, sender_id, read")
        .neq("sender_id", user.id)
        .eq("read", false);

      if (error) throw error;

      // Then count them by conversation_id
      const counts = messages
        ? messages.reduce(
            (acc: Record<string, number>, msg: { conversation_id: string }) => {
              acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          )
        : {};

      // Convert to our UnreadCount format (reuse rideId as conversationId for now)
      setUnreadCounts(
        Object.entries(counts).map(
          ([conversation_id, count]): UnreadCount => ({
            rideId: conversation_id,
            count: count as number,
          })
        )
      );
    } catch (error) {
      console.error("Error loading unread counts:", error);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadUnreadCounts();
  }, [loadUnreadCounts]);

  const markAsRead = async (rideId: string) => {
    if (!user) return;

    try {
      await fetch(`/api/messages/read/${rideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id }),
      });

      setUnreadCounts((prev) =>
        prev.filter((count) => count.rideId !== rideId)
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const subscribeToRide = useCallback(
    (conversationId: string) => {
      if (subscribedRides.has(conversationId) || channelsRef.current.has(conversationId))
        return;

      const channel = supabase
        .channel(`chat:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload: any) => {
            const message = payload.new as { sender_id: string; read: boolean };
            if (message.sender_id !== user?.id && !message.read) {
              setUnreadCounts((prev) => {
                const existing = prev.find((c) => c.rideId === conversationId);
                if (existing) {
                  return prev.map((c) =>
                    c.rideId === conversationId ? { ...c, count: c.count + 1 } : c
                  );
                } else {
                  return [...prev, { rideId: conversationId, count: 1 }];
                }
              });
            }
          }
        )
        .subscribe();

      channelsRef.current.set(conversationId, channel);
      setSubscribedRides((prev) => new Set(prev).add(conversationId));
    },
    [supabase, user, subscribedRides]
  );

  const unsubscribeFromRide = useCallback(
    (rideId: string) => {
      const channel = channelsRef.current.get(rideId);
      if (channel) {
        supabase.removeChannel(channel);
        channelsRef.current.delete(rideId);
        setSubscribedRides((prev) => {
          const newSet = new Set(prev);
          newSet.delete(rideId);
          return newSet;
        });
      }
    },
    [supabase]
  );

  // Cleanup subscriptions when user changes
  useEffect(() => {
    if (!user) {
      // Clear all subscriptions when user logs out
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
      setSubscribedRides(new Set());
      setUnreadCounts([]);
      initializedRef.current = false;
    }
  }, [user, supabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
  }, [supabase]);

  return (
    <ChatContext.Provider
      value={{
        unreadCounts,
        markAsRead,
        subscribeToRide,
        unsubscribeFromRide,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
