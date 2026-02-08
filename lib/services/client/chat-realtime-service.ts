import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "@/types";

export type RealtimeMessageWithSender = Message & {
  sender?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
};

export function subscribeToUserConversationMessages(
  supabase: SupabaseClient,
  userId: string,
  onMessage: (message: RealtimeMessageWithSender) => void
) {
  const channel = supabase
    .channel(`user-conversations:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `receiver_id=eq.${userId}`,
      },
      async (payload: any) => {
        const newMessage = payload.new as Message;

        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .eq("id", newMessage.sender_id)
          .single();

        onMessage({
          ...newMessage,
          sender: senderProfile
            ? {
                id: senderProfile.id,
                full_name: senderProfile.full_name,
                avatar_url: senderProfile.avatar_url,
              }
            : undefined,
        });
      }
    )
    .subscribe();

  return channel;
}
