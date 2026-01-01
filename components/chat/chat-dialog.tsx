"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import { useNotificationPromptTrigger } from "@/hooks/notifications/useNotificationPrompt";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAvatarUrl } from "@/lib/utils/avatar-url";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  ride_id: string;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  conversationId: string;
  otherUserId: string;
  otherUserName: string | null;
  otherUserAvatar?: string;
}

export function ChatDialog({
  isOpen,
  onClose,
  rideId,
  conversationId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
}: ChatDialogProps) {
  const { user, supabase } = useSupabase();
  const {
    messages,
    messagesLoading,
    messagesError,
    conversations,
    fetchMessages,
    sendMessage,
    markAsRead,
    subscribeToRide,
    unsubscribeFromRide,
  } = useChatStore();
  
  const { triggerPrompt } = useNotificationPromptTrigger();
  
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fetchedConversationsRef = useRef<Set<string>>(new Set());
  
  // Track the actual conversationId (may differ from prop if conversation was just created)
  const [actualConversationId, setActualConversationId] = useState(conversationId);
  
  // Update actualConversationId when prop changes (e.g., dialog reopened with different conversation)
  useEffect(() => {
    setActualConversationId(conversationId);
  }, [conversationId]);
  
  // Detect if this is a new conversation (actualConversationId === rideId means no conversation exists yet)
  const isNewConversation = actualConversationId === rideId || !conversations.find(c => c.id === actualConversationId);
  
  const conversationMessages = messages[actualConversationId] || [];
  const isLoading = messagesLoading[actualConversationId] || false;
  const error = messagesError[actualConversationId] || null;
  
  // For new conversations, don't show error - empty state is expected
  const shouldShowError = error && !isNewConversation;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && user) {
      // Fetch messages if:
      // 1. Not already fetched for this conversation
      // 2. Not a new conversation
      // 3. Messages array is empty (in case real-time didn't populate it)
      const currentMessages = messages[actualConversationId] || [];
      const hasMessages = currentMessages.length > 0;
      const shouldFetch = !fetchedConversationsRef.current.has(actualConversationId) && !isNewConversation;
      
      if (shouldFetch || (!hasMessages && !isNewConversation)) {
        fetchMessages(actualConversationId);
        fetchedConversationsRef.current.add(actualConversationId);
      }
      subscribeToRide(rideId);

      // Mark messages as read when dialog opens (only if conversation exists)
      if (!isNewConversation) {
        markAsRead(actualConversationId, user.id).catch(() => {
          // Silently fail - non-critical operation
        });
      }

      return () => {
        unsubscribeFromRide(rideId);
      };
    }
  }, [isOpen, user, actualConversationId, isNewConversation, messages, fetchMessages, subscribeToRide, unsubscribeFromRide, markAsRead, rideId]);

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  // Mark messages as read when viewing them (debounced to avoid excessive API calls)
  useEffect(() => {
    if (isOpen && user && actualConversationId && conversationMessages.length > 0 && !isNewConversation) {
      const timer = setTimeout(() => {
        markAsRead(actualConversationId, user.id).catch(() => {
          // Silently fail - non-critical operation
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isOpen, actualConversationId, user, conversationMessages.length, isNewConversation, markAsRead]);

  // Clear fetched conversations when actualConversationId changes
  useEffect(() => {
    return () => {
      fetchedConversationsRef.current.clear();
    };
  }, [actualConversationId]);

  // Watch for new conversation in store (when first message creates it)
  useEffect(() => {
    if (isNewConversation && conversations.length > 0) {
      const newConv = conversations.find(c => c.rideId === rideId);
      if (newConv && newConv.id !== actualConversationId) {
        setActualConversationId(newConv.id);
      }
    }
  }, [conversations, rideId, isNewConversation, actualConversationId]);


  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage(""); // Clear input immediately for better UX

    try {
      // Send message directly - the backend will handle conversation lookup/creation
      const newMessageResponse = await sendMessage({
        ride_id: rideId,
        content: messageContent,
      });

      // Update actualConversationId if a new conversation was created
      if (newMessageResponse?.conversation_id && newMessageResponse.conversation_id !== actualConversationId) {
        setActualConversationId(newMessageResponse.conversation_id);
      }

      // Trigger notification prompt after sending message
      triggerPrompt();

      scrollToBottom();
    } catch (error) {
      setNewMessage(messageContent); // Restore message if failed
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: "Please try again later.",
      });
    }
  };

  useEffect(() => {
    if (isOpen && user && !isNewConversation && actualConversationId) {
      // Mark messages as read when opening the chat (non-blocking)
      // Only for existing conversations, not new ones
      markAsRead(actualConversationId, user.id).catch(() => {
        // Silently fail - non-critical operation
      });
    }
  }, [isOpen, user, actualConversationId, isNewConversation, markAsRead]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={getAvatarUrl(supabase, otherUserAvatar)} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                {(otherUserName || "Utilisateur").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <DialogTitle>{otherUserName || "Utilisateur"}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pr-4">
            {isLoading && !isNewConversation ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : shouldShowError ? (
              <div className="text-center py-4 text-red-500">
                <p>Error loading messages: {error}</p>
              </div>
            ) : conversationMessages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Aucun message pour l'instant. Lancez la conversation !</p>
              </div>
            ) : (
              conversationMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender_id === user?.id
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`flex gap-2 max-w-[80%] ${
                    message.sender_id === user?.id ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.sender?.avatar_url ? getAvatarUrl(supabase, message.sender.avatar_url) : undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium text-xs">
                      {message.sender?.full_name?.charAt(0).toUpperCase() ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg px-3 py-2 ${
                      message.sender_id === user?.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {format(new Date(message.created_at), "p")}
                    </p>
                  </div>
                </div>
              </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t mt-auto">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="resize-none"
              rows={1}
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              disabled={!newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
