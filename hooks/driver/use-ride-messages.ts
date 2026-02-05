"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/providers/SupabaseProvider";
import { useToast } from "@/hooks/ui";
import type { RideWithMessages } from "@/types/chat";
import {
  fetchRideWithMessages,
  subscribeToRideMessages,
  sendRideMessage,
  getReceiverIdForRide,
} from "@/lib/services/client/rides";

export function useRideMessages(rideId: string) {
  const router = useRouter();
  const { supabase, user } = useSupabase();
  const { toast } = useToast();
  const [ride, setRide] = useState<RideWithMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
      return;
    }

    const load = async () => {
      const result = await fetchRideWithMessages(supabase, rideId, user.id);
      if (!result.success) {
        toast({
          title: "Error",
          description: result.error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (!result.data) {
        toast({
          title: "Ride not found",
          description: "The requested ride could not be found.",
          variant: "destructive",
        });
        router.push("/driver/dashboard");
        return;
      }
      setRide(result.data);
      setLoading(false);
    };

    load();

    const unsubscribe = subscribeToRideMessages(supabase, rideId, (newMessage) => {
      setRide((current) => {
        if (!current) return null;
        return {
          ...current,
          messages: [...current.messages, newMessage],
        };
      });
    });

    return unsubscribe;
  }, [user, router, supabase, rideId, toast]);

  const sendMessage = async (content: string): Promise<boolean> => {
    if (!user || !ride || !content.trim()) return false;

    const receiverId = getReceiverIdForRide(ride, user.id);
    if (!receiverId) {
      toast({
        title: "Error",
        description: "No passenger found for this ride",
        variant: "destructive",
      });
      return false;
    }

    setSending(true);
    const result = await sendRideMessage(supabase, {
      rideId,
      senderId: user.id,
      receiverId,
      content: content.trim(),
    });
    setSending(false);

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error.message,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  return { ride, loading, sending, sendMessage };
}
