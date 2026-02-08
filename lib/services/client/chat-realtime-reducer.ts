import type { Message, UIConversation } from "@/types";

type UnreadCount = { conversationId: string; count: number };

type ChatStateSnapshot = {
  conversations: UIConversation[];
  unreadCounts: UnreadCount[];
  messages: Record<string, Message[]>;
};

export function applyIncomingConversationMessage(
  state: ChatStateSnapshot,
  message: Message,
  userId: string,
  sortConversations: (conversations: UIConversation[]) => UIConversation[]
): ChatStateSnapshot | null {
  const conversationExists = state.conversations.some(
    (conv) => conv.id === message.conversation_id
  );

  const currentMessages = state.messages[message.conversation_id] || [];
  const messageExists = currentMessages.some((m) => m.id === message.id);

  if (messageExists) {
    return null;
  }

  const isFromCurrentUser = message.sender_id === userId;
  let updatedUnreadCounts = [...state.unreadCounts];

  if (!isFromCurrentUser) {
    const existingIndex = updatedUnreadCounts.findIndex(
      (uc) => uc.conversationId === message.conversation_id
    );

    if (existingIndex >= 0) {
      updatedUnreadCounts[existingIndex] = {
        ...updatedUnreadCounts[existingIndex],
        count: updatedUnreadCounts[existingIndex].count + 1,
      };
    } else {
      updatedUnreadCounts.push({
        conversationId: message.conversation_id,
        count: 1,
      });
    }
  }

  if (!conversationExists) {
    return {
      conversations: state.conversations,
      unreadCounts: updatedUnreadCounts,
      messages: state.messages,
    };
  }

  const conversation = state.conversations.find(
    (conv) => conv.id === message.conversation_id
  );

  if (!conversation) {
    return {
      conversations: state.conversations,
      unreadCounts: updatedUnreadCounts,
      messages: state.messages,
    };
  }

  const updatedConversations = state.conversations.map((conv) => {
    if (conv.id === message.conversation_id) {
      const newUnreadCount = !isFromCurrentUser
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

  const finalUnreadCounts = updatedConversations
    .filter((conv) => conv.unreadCount > 0)
    .map((conv) => ({
      conversationId: conv.id,
      count: conv.unreadCount,
    }));

  const mergedUnreadCounts = [...finalUnreadCounts];
  updatedUnreadCounts.forEach((uc) => {
    if (!finalUnreadCounts.find((fuc) => fuc.conversationId === uc.conversationId)) {
      mergedUnreadCounts.push(uc);
    }
  });

  return {
    conversations: sortConversations(updatedConversations),
    unreadCounts: mergedUnreadCounts,
    messages: messageExists
      ? state.messages
      : {
          ...state.messages,
          [message.conversation_id]: [...currentMessages, message],
        },
  };
}
