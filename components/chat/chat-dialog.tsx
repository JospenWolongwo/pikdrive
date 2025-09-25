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
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
}

export function ChatDialog({
  isOpen,
  onClose,
  rideId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
}: ChatDialogProps) {
  const { user } = useSupabase();
  const {
    messages,
    messagesLoading,
    messagesError,
    fetchMessages,
    sendMessage,
    markAsRead,
    subscribeToRide,
    unsubscribeFromRide,
    getOrCreateConversation,
  } = useChatStore();
  
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const rideMessages = messages[rideId] || [];
  const isLoading = messagesLoading[rideId] || false;
  const error = messagesError[rideId] || null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && user) {
      // Fetch messages and subscribe to real-time updates
      fetchMessages(rideId);
      subscribeToRide(rideId);

      return () => {
        unsubscribeFromRide(rideId);
      };
    }
  }, [isOpen, user, rideId, fetchMessages, subscribeToRide, unsubscribeFromRide]);

  useEffect(() => {
    scrollToBottom();
  }, [rideMessages]);


  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage(""); // Clear input immediately for better UX

    try {
      // First, get or create conversation
      const conversation = await getOrCreateConversation({
        ride_id: rideId,
        driver_id: rideId, // This needs to be determined based on ride data
        passenger_id: otherUserId,
      });

      // Send message using chatStore
      await sendMessage({
        conversation_id: conversation.id,
        content: messageContent,
      });

      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageContent); // Restore message if failed
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: "Please try again later.",
      });
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      // Mark messages as read when opening the chat
      markAsRead(rideId, user.id);
    }
  }, [isOpen, user, rideId, markAsRead]);

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
              <AvatarImage src={otherUserAvatar} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
                {otherUserName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <DialogTitle>{otherUserName}</DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 pr-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-4 text-red-500">
                <p>Error loading messages: {error}</p>
              </div>
            ) : rideMessages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              rideMessages.map((message) => (
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
                    <AvatarImage src={message.sender?.avatar_url} />
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
