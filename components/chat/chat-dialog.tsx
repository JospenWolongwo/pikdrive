"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Textarea,
  toast,
  Avatar,
  AvatarFallback,
  AvatarImage,
  ScrollArea,
} from "@/components/ui";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useChatStore } from "@/stores/chatStore";
import { useNotificationPromptTrigger } from "@/hooks";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { getAvatarUrl } from "@/lib/utils/avatar-url";
import { useLocale } from "@/hooks";
import { ApiError } from "@/lib/api-client";
import { SENSITIVE_CONTACT_ERROR_CODE } from "@/lib/utils/message-filter";

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
  const { t } = useLocale();
  const {
    messages,
    messagesLoading,
    messagesError,
    conversations,
    fetchMessages,
    sendMessage,
    addOptimisticMessage,
    removeOptimisticMessage,
    markAsRead,
    subscribeToRide,
    unsubscribeFromRide,
  } = useChatStore();
  
  const { triggerPrompt } = useNotificationPromptTrigger();
  
  const [newMessage, setNewMessage] = useState("");
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [visualViewportOffsetTop, setVisualViewportOffsetTop] = useState<number | null>(null);
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
      
      // Subscribe to conversation messages (only if conversation exists)
      if (!isNewConversation && actualConversationId) {
        subscribeToRide(actualConversationId);
      }

      // Mark messages as read when dialog opens (only if conversation exists)
      if (!isNewConversation) {
        markAsRead(actualConversationId, user.id).catch(() => {
          // Silently fail - non-critical operation
        });
      }

      return () => {
        if (!isNewConversation && actualConversationId) {
          unsubscribeFromRide(actualConversationId);
        }
      };
    }
  }, [isOpen, user, actualConversationId, isNewConversation, messages, fetchMessages, subscribeToRide, unsubscribeFromRide, markAsRead, rideId]);

  useEffect(() => {
    scrollToBottom();
  }, [conversationMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateViewport = () => {
      setVisualViewportHeight(viewport.height);
      setVisualViewportOffsetTop(viewport.offsetTop);
    };

    updateViewport();
    viewport.addEventListener("resize", updateViewport);
    viewport.addEventListener("scroll", updateViewport);

    return () => {
      viewport.removeEventListener("resize", updateViewport);
      viewport.removeEventListener("scroll", updateViewport);
    };
  }, []);

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
        // Subscribe to the new conversation immediately
        subscribeToRide(newConv.id);
      }
    }
  }, [conversations, rideId, isNewConversation, actualConversationId, subscribeToRide]);


  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    if (!isNewConversation) {
      addOptimisticMessage(actualConversationId, {
        content: messageContent,
        sender_id: user.id,
      });
    }
    scrollToBottom();

    try {
      const newMessageResponse = await sendMessage({
        ride_id: rideId,
        content: messageContent,
      });

      if (newMessageResponse?.conversation_id && newMessageResponse.conversation_id !== actualConversationId) {
        setActualConversationId(newMessageResponse.conversation_id);
      }

      triggerPrompt();
      scrollToBottom();
    } catch (error) {
      if (!isNewConversation) {
        removeOptimisticMessage(actualConversationId);
      }
      setNewMessage(messageContent);
      const isSensitiveContact =
        error instanceof ApiError &&
        (error.message === SENSITIVE_CONTACT_ERROR_CODE ||
          error.data?.error === SENSITIVE_CONTACT_ERROR_CODE);
      toast({
        variant: "destructive",
        title: isSensitiveContact
          ? t("pages.chat.sensitiveContactNotAllowed")
          : t("pages.chat.errorSending"),
        description: isSensitiveContact
          ? t("pages.chat.sensitiveContactNotAllowedDescription")
          : t("pages.chat.errorSendingDescription"),
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
      <DialogContent
        style={
          visualViewportHeight !== null || visualViewportOffsetTop !== null
            ? ({
                ["--chat-vvh" as string]:
                  visualViewportHeight !== null ? `${visualViewportHeight}px` : undefined,
                ["--chat-vvo" as string]:
                  visualViewportOffsetTop !== null ? `${visualViewportOffsetTop}px` : undefined,
              } as React.CSSProperties)
            : undefined
        }
        className="flex flex-col p-0 overflow-hidden max-w-md w-[calc(100%-2rem)] sm:w-full top-[calc(var(--chat-vvo,0px)+1rem)] left-4 right-4 sm:left-[50%] sm:right-auto sm:top-[50%] translate-x-0 translate-y-0 sm:translate-y-[-50%] sm:translate-x-[-50%] h-[calc(var(--chat-vvh,100svh)-2rem)] max-h-[calc(var(--chat-vvh,100svh)-2rem)] sm:h-[80vh] data-[state=open]:slide-in-from-left-0 data-[state=closed]:slide-out-to-left-0 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=closed]:slide-out-to-left-1/2"
      >
        <DialogHeader className="shrink-0 p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={getAvatarUrl(supabase, otherUserAvatar)} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                {(otherUserName || "Utilisateur").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <DialogTitle className="truncate">{otherUserName || "Utilisateur"}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 p-4">
          <div className="space-y-4 pr-4">
            {isLoading && !isNewConversation ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : shouldShowError ? (
              <div className="text-center py-4 text-red-500">
                <p>{t("pages.chat.error")}: {error}</p>
              </div>
            ) : conversationMessages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>{t("pages.chat.noMessages")}</p>
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

        <div className="shrink-0 p-4 border-t bg-background">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("pages.chat.typeMessage")}
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
