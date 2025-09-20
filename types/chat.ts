export interface Message {
  readonly id: string;
  readonly conversation_id: string;
  readonly sender_id: string;
  readonly content: string;
  readonly message_type: MessageType;
  readonly created_at: string;
  readonly updated_at: string;
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
