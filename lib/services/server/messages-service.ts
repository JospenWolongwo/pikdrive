import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Message } from "@/types";
import { containsSensitiveContactInfo, SENSITIVE_CONTACT_ERROR_CODE } from "@/lib/utils/message-filter";
import { ServerOneSignalNotificationService } from "@/lib/services/server";

export const SENSITIVE_CONTACT_ERROR = SENSITIVE_CONTACT_ERROR_CODE;

/** Thrown by service; route handlers map to HTTP status */
export class MessagesServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "MessagesServiceError";
  }
}

export interface ConversationForRide {
  readonly id: string;
  readonly participants: string[];
}

export interface MessageWithSender extends Omit<Message, "sender"> {
  readonly sender: {
    readonly id: string;
    readonly full_name: string | null;
    readonly avatar_url?: string | null;
  };
}

/**
 * Server-side MessagesService for API routes.
 * Handles conversation resolution (by ride), send message, mark read, get messages.
 */
export class ServerMessagesService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get or create the conversation for a ride and user. Other participant is driver or first passenger.
   */
  async getOrCreateConversationByRide(
    rideId: string,
    userId: string
  ): Promise<ConversationForRide> {
    const { data: conversations, error: convError } = await this.supabase
      .from("conversations")
      .select("id, participants")
      .eq("ride_id", rideId);

    if (convError) {
      throw new MessagesServiceError(
        convError.message,
        "CONVERSATION_FETCH_FAILED",
        500
      );
    }

    const existing = conversations?.find((c: { participants: string[] }) =>
      c.participants.includes(userId)
    );
    if (existing) {
      return { id: existing.id, participants: existing.participants };
    }

    const { data: ride, error: rideError } = await this.supabase
      .from("rides")
      .select("driver_id")
      .eq("id", rideId)
      .single();

    if (rideError || !ride) {
      throw new MessagesServiceError("Ride not found", "RIDE_NOT_FOUND", 404);
    }

    let otherParticipant: string | null = null;
    if (ride.driver_id === userId) {
      const { data: booking, error: bookingError } = await this.supabase
        .from("bookings")
        .select("user_id")
        .eq("ride_id", rideId)
        .neq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (bookingError) {
        throw new MessagesServiceError(
          "Error finding passenger",
          "BOOKING_FETCH_FAILED",
          500
        );
      }
      otherParticipant = booking?.user_id ?? null;
    } else {
      otherParticipant = ride.driver_id;
    }

    if (!otherParticipant) {
      throw new MessagesServiceError(
        "No other participant found for this ride",
        "NO_OTHER_PARTICIPANT",
        404
      );
    }

    const { data: newConv, error: createError } = await this.supabase
      .from("conversations")
      .insert({
        ride_id: rideId,
        participants: [userId, otherParticipant],
      })
      .select("id, participants")
      .single();

    if (createError) {
      throw new MessagesServiceError(
        createError.message,
        "CONVERSATION_CREATE_FAILED",
        500
      );
    }

    return { id: newConv.id, participants: newConv.participants };
  }

  /**
   * Send a message (resolve conversation from rideId if needed), validate content, insert, optionally notify.
   */
  async sendMessage(
    params: { conversation_id?: string; ride_id?: string; content: string },
    userId: string
  ): Promise<MessageWithSender> {
    let conversationId = params.conversation_id;
    if (!conversationId && params.ride_id) {
      const conv = await this.getOrCreateConversationByRide(
        params.ride_id,
        userId
      );
      conversationId = conv.id;
    }
    if (!conversationId) {
      throw new MessagesServiceError(
        "conversation_id or ride_id required",
        "BAD_REQUEST",
        400
      );
    }

    const content = params.content.trim();
    if (containsSensitiveContactInfo(content)) {
      throw new MessagesServiceError(
        "Message contains sensitive contact information",
        SENSITIVE_CONTACT_ERROR,
        400
      );
    }

    const { data: message, error: messageError } = await this.supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        read: false,
      })
      .select("*")
      .single();

    if (messageError) {
      throw new MessagesServiceError(
        messageError.message,
        "MESSAGE_INSERT_FAILED",
        500
      );
    }

    const { data: senderProfile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw new MessagesServiceError(
        "Error fetching sender profile",
        "PROFILE_FETCH_FAILED",
        500
      );
    }

    const messageWithSender: MessageWithSender = {
      ...message,
      sender: {
        id: senderProfile.id,
        full_name: senderProfile.full_name ?? "Unknown",
        avatar_url: senderProfile.avatar_url ?? null,
      },
    };

    this.sendPushToRecipient(
      conversationId,
      userId,
      senderProfile.full_name,
      content
    ).catch((err) =>
      console.error("❌ Failed to send push notification:", err)
    );

    return messageWithSender;
  }

  private async sendPushToRecipient(
    conversationId: string,
    senderId: string,
    senderName: string | null,
    content: string
  ): Promise<void> {
    const { data: conv } = await this.supabase
      .from("conversations")
      .select("participants, ride_id")
      .eq("id", conversationId)
      .single();

    if (!conv) return;
    const recipientId = conv.participants.find((id: string) => id !== senderId);
    if (!recipientId) return;

    const notificationService = new ServerOneSignalNotificationService(
      this.supabase
    );
    await notificationService.sendMessageNotification(
      recipientId,
      senderId,
      senderName ?? "Someone",
      content.substring(0, 100),
      conversationId,
      conv.ride_id
    );
  }

  /**
   * Mark messages in a conversation as read (for the given user, messages not sent by them).
   */
  async markMessagesAsRead(
    conversationId: string,
    userId: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("read", false)
      .select("id");

    if (error) {
      throw new MessagesServiceError(
        error.message,
        "MARK_READ_FAILED",
        500
      );
    }
    return data?.length ?? 0;
  }

  /**
   * Get messages for a conversation with sender profiles.
   */
  async getMessagesWithSenders(
    conversationId: string
  ): Promise<MessageWithSender[]> {
    const { data: messages, error: messagesError } = await this.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw new MessagesServiceError(
        messagesError.message,
        "MESSAGES_FETCH_FAILED",
        500
      );
    }

    if (!messages?.length) return [];

    const senderIds = [...new Set(messages.map((m: { sender_id: string }) => m.sender_id))];
    const { data: profiles, error: profilesError } = await this.supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", senderIds);

    if (profilesError) {
      throw new MessagesServiceError(
        profilesError.message,
        "PROFILES_FETCH_FAILED",
        500
      );
    }

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url?: string | null }) => [
        p.id,
        { id: p.id, full_name: p.full_name ?? "Unknown", avatar_url: p.avatar_url ?? null },
      ])
    );

    return messages.map((msg: Message) => ({
      ...msg,
      sender:
        profileMap.get(msg.sender_id) ?? {
          id: msg.sender_id,
          full_name: "Unknown",
          avatar_url: null,
        },
    })) as MessageWithSender[];
  }
}

/** Shared error response for messages API routes. Uses error.code for SENSITIVE_CONTACT_ERROR so the client can show the translated toast. */
export function toMessagesErrorResponse(error: unknown): NextResponse {
  if (error instanceof MessagesServiceError) {
    return NextResponse.json(
      { success: false, error: error.code === SENSITIVE_CONTACT_ERROR ? error.code : error.message },
      { status: error.statusCode }
    );
  }
  return NextResponse.json(
    { success: false, error: "Internal server error" },
    { status: 500 }
  );
}
