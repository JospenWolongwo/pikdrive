export interface Message {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_id: string;
  readonly content: string;
  readonly message_type: MessageType;
  readonly created_at: string;
  readonly updated_at: string;
  readonly sender?: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
}

export type MessageType = 
  | 'text'
  | 'image'
  | 'file'
  | 'system';

export interface Conversation {
  readonly id: string;
  readonly ride_id: string;
  readonly driver_id: string;
  readonly passenger_id: string;
  readonly last_message?: Message;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ConversationWithParticipants extends Conversation {
  readonly driver: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
  readonly passenger: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
  readonly ride?: {
    readonly id: string;
    readonly from_city: string;
    readonly to_city: string;
    readonly departure_time: string;
    readonly driver_id: string;
  };
  readonly messages?: Message[];
}

export interface CreateMessageRequest {
  readonly conversation_id: string;
  readonly content: string;
  readonly message_type?: MessageType;
}

export interface CreateConversationRequest {
  readonly ride_id: string;
  readonly driver_id: string;
  readonly passenger_id: string;
}

// UI-specific conversation type for messages page
export interface UIConversation {
  readonly id: string;
  readonly rideId: string;
  readonly otherUserId: string;
  readonly otherUserName: string;
  readonly otherUserAvatar?: string;
  readonly lastMessage: string;
  readonly lastMessageTime: string;
  readonly unreadCount: number;
  readonly ride: {
    readonly from_city: string;
    readonly to_city: string;
    readonly departure_time: string;
  };
}

// Ride-specific message type for dashboard
export interface RideMessage {
  readonly id: string;
  readonly ride_id: string;
  readonly content: string;
  readonly created_at: string;
  readonly sender: {
    readonly id: string;
    readonly full_name: string;
    readonly avatar_url?: string;
  };
}

// Conversation summary for ride dashboard
export interface RideConversationSummary {
  readonly conversationId: string;
  readonly passengerId: string;
  readonly passengerName: string;
  readonly passengerAvatar?: string;
  readonly lastMessage: string;
  readonly lastMessageTime: string;
  readonly unreadCount: number;
}
