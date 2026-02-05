"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { MessageCircle, Send } from "lucide-react";
import { format } from "date-fns";
import { useRideMessages } from "@/hooks/driver";

export default function RideMessagesPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { ride, loading, sending, sendMessage } = useRideMessages(params.id);
  const [newMessage, setNewMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendMessage(newMessage);
    if (success) setNewMessage("");
  };

  if (loading) {
    return (
      <div className="container py-10">
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!ride) return null;

  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-muted-foreground mt-1">
              {ride.from_city} to {ride.to_city} -{" "}
              {format(new Date(ride.departure_time), "PPP p")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/driver/dashboard")}
          >
            Back to Dashboard
          </Button>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div className="space-y-4">
              {ride.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="mx-auto h-8 w-8 mb-2" />
                  <p>No messages yet</p>
                </div>
              ) : (
                ride.messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-2 p-3 rounded-lg bg-muted"
                  >
                    <MessageCircle className="w-4 h-4 mt-1 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">
                        {message.sender.full_name}
                      </div>
                      <div className="text-sm">{message.content}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(message.created_at), "PP p")}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
