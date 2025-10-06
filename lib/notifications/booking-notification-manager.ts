"use client";

import { SupabaseClient } from "@supabase/supabase-js";
import { notificationService } from "./notification-service";

interface Booking {
  id: string;
  ride_id: string;
  user_id: string;
  seats: number;
  status: string;
  created_at: string;
}

interface Ride {
  id: string;
  driver_id: string;
  from_city: string;
  to_city: string;
  departure_time: string;
  price: number;
}

interface User {
  id: string;
  full_name?: string;
  phone?: string;
}

export class BookingNotificationManager {
  private isActive = false;
  private supabase: SupabaseClient;
  private userId: string;
  private channel: any = null;
  private recentNotifications: Set<string> = new Set();
  private onBookingClick?: () => void;

  constructor(
    supabase: SupabaseClient,
    userId: string,
    onBookingClick?: () => void
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.onBookingClick = onBookingClick;
  }

  async start(): Promise<void> {
    if (this.isActive) {
      return;
    }

    try {
      await this.loadRecentBookings();
      await this.setupRealtimeSubscription();
      this.isActive = true;
    } catch (error) {
      console.error("❌ Failed to start BookingNotificationManager:", error);
    }
  }

  async stop(): Promise<void> {
    if (!this.isActive) return;

    try {
      if (this.channel) {
        await this.supabase.removeChannel(this.channel);
        this.channel = null;
      }
      this.isActive = false;
    } catch (error) {
      console.error("❌ Error stopping BookingNotificationManager:", error);
    }
  }

  private async loadRecentBookings(): Promise<void> {
    try {
      const { data: bookings } = await this.supabase
        .from("bookings")
        .select("id, created_at")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (bookings) {
        bookings.forEach((booking) => {
          this.recentNotifications.add(booking.id);
        });
      }
    } catch (error) {
      console.error("❌ Error loading recent bookings:", error);
    }
  }

  private async setupRealtimeSubscription(): Promise<void> {
    try {
      // Create a channel that listens for all booking changes
      this.channel = this.supabase
        .channel(`bookings:${this.userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bookings",
          },
          async (payload) => {
            await this.handleNewBooking(payload);
          }
        )
        .subscribe();

    } catch (error) {
      console.error("❌ Error setting up booking subscription:", error);
    }
  }

  private async handleNewBooking(payload: any): Promise<void> {
    try {
      const booking = payload.new as Booking;

      if (this.recentNotifications.has(booking.id)) {
        return;
      }

      this.recentNotifications.add(booking.id);

      const { data: ride } = await this.supabase
        .from("rides")
        .select("*")
        .eq("id", booking.ride_id)
        .single();

      if (!ride) {
        console.warn("⚠️ Ride not found for booking:", booking.id);
        return;
      }

      // Check if this user is the passenger (booking creator)
      if (booking.user_id === this.userId) {
        // User created this booking - show passenger notification
        const driver = await this.getUserInfo(ride.driver_id);
        const driverName = driver?.full_name || driver?.phone || "Driver";
        await this.showUserBookingNotification(booking, ride, driverName);
      }

      // Check if this user is the driver
      if (ride.driver_id === this.userId) {
        // User is the driver - show driver notification
        await this.showDriverBookingNotification(booking, ride);
      }

      if (this.recentNotifications.size > 50) {
        const notificationsArray = Array.from(this.recentNotifications);
        this.recentNotifications = new Set(notificationsArray.slice(-50));
      }
    } catch (error) {
      console.error("❌ Error handling new booking:", error);
    }
  }

  private async getUserInfo(userId: string): Promise<User | null> {
    try {
      const { data: user } = await this.supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("id", userId)
        .single();

      return user;
    } catch (error) {
      console.error("❌ Error getting user info:", error);
      return null;
    }
  }

  private async showUserBookingNotification(
    booking: Booking,
    ride: Ride,
    driverName: string
  ): Promise<void> {
    try {
      // NOTE: No sound notification for booking creation - only after successful payment
      // Sound notifications will be handled by payment completion flow
      await notificationService.showNotification({
        title: "🎫 Reservation Creee !",
        body: `Votre reservation pour ${ride.from_city} → ${ride.to_city} a ete creee. Completez le paiement pour confirmer.`,
        icon: "/icons/icon-192x192.png",
        tag: "booking-created",
        sound: false, // No sound - only after payment success
        vibrate: [], // No vibration - only after payment success
        onClick: () => {
          if (this.onBookingClick) {
            this.onBookingClick();
          }
        },
      });
    } catch (error) {
      console.error("❌ Error showing user booking notification:", error);
    }
  }

  private async showDriverBookingNotification(
    booking: Booking,
    ride: Ride
  ): Promise<void> {
    try {
      const passenger = await this.getUserInfo(booking.user_id);
      const passengerName =
        passenger?.full_name || passenger?.phone || "Passenger";

      await notificationService.showNotification({
        title: "🚗 Nouvelle Reservation !",
        body: `${passengerName} a reserve ${booking.seats} place(s) pour ${ride.from_city} → ${ride.to_city}.`,
        icon: "/icons/icon-192x192.png",
        tag: "new-booking",
        sound: true,
        vibrate: [200, 100, 200],
        onClick: () => {
          if (this.onBookingClick) {
            this.onBookingClick();
          }
        },
      });
    } catch (error) {
      console.error("❌ Error showing driver booking notification:", error);
    }
  }

  async showImmediateBookingNotification(
    booking: Booking,
    ride: Ride,
    isDriver: boolean = false
  ): Promise<void> {
    try {
      if (isDriver) {
        const passenger = await this.getUserInfo(booking.user_id);
        const passengerName =
          passenger?.full_name || passenger?.phone || "Passenger";

        // NOTE: No sound notification for booking creation - only after successful payment
        await notificationService.showNotification({
          title: "🚗 Nouvelle Reservation !",
          body: `${passengerName} a reserve ${booking.seats} place(s) pour ${ride.from_city} → ${ride.to_city}.`,
          icon: "/icons/icon-192x192.png",
          tag: "new-booking-immediate",
          sound: false, // No sound - only after payment success
          vibrate: [], // No vibration - only after payment success
        });
      } else {
        const driver = await this.getUserInfo(ride.driver_id);
        const driverName = driver?.full_name || driver?.phone || "Driver";

        // NOTE: No sound notification for booking creation - only after successful payment
        await notificationService.showNotification({
          title: "🎫 Reservation Creee !",
          body: `Votre reservation pour ${ride.from_city} → ${ride.to_city} a ete creee. Completez le paiement pour confirmer.`,
          icon: "/icons/icon-192x192.png",
          tag: "booking-created",
          sound: false, // No sound - only after payment success
          vibrate: [], // No vibration - only after payment success
        });
      }

    } catch (error) {
      console.error("❌ Error showing immediate booking notification:", error);
    }
  }

  isRunning(): boolean {
    return this.isActive;
  }
}

let globalBookingNotificationManager: BookingNotificationManager | null = null;

export function getGlobalBookingNotificationManager(): BookingNotificationManager | null {
  return globalBookingNotificationManager;
}

export function initializeGlobalBookingNotificationManager(
  supabase: SupabaseClient,
  userId: string,
  onBookingClick?: () => void
): BookingNotificationManager {
  if (globalBookingNotificationManager) {
    globalBookingNotificationManager.stop();
  }

  globalBookingNotificationManager = new BookingNotificationManager(
    supabase,
    userId,
    onBookingClick
  );

  return globalBookingNotificationManager;
}

export function cleanupGlobalBookingNotificationManager() {
  if (globalBookingNotificationManager) {
    globalBookingNotificationManager.stop();
    globalBookingNotificationManager = null;
  }
}
