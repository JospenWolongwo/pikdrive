import type { UIConversation } from "@/types";

interface UnreadCount {
  conversationId: string;
  count: number;
}

export interface UnreadCounts {
  [rideId: string]: number;
}

/**
 * Maps unread counts from conversation-based structure to ride-based structure
 * @param unreadCountsArray Array of unread counts by conversationId
 * @param conversations Array of conversations to map conversationId to rideId
 * @returns Dictionary mapping rideId to unread count
 */
export function mapUnreadCountsByRideId(
  unreadCountsArray: UnreadCount[],
  conversations: UIConversation[]
): UnreadCounts {
  return (unreadCountsArray || []).reduce(
    (acc: UnreadCounts, curr) => {
      // Find the conversation to get the rideId
      const conversation = conversations.find((conv) => conv.id === curr.conversationId);
      if (conversation) {
        acc[conversation.rideId] = curr.count;
      }
      return acc;
    },
    {} as UnreadCounts
  );
}

