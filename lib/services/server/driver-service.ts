import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import type { DriverPublicProfile, RidePreview } from '@/types/driver';

/**
 * Server-side DriverService for use in API routes
 * Uses direct Supabase client access (no HTTP calls)
 */
export class ServerDriverService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get public driver profile with statistics and recent rides
   * Only returns approved drivers
   */
  async getPublicDriverProfile(driverId: string): Promise<DriverPublicProfile | null> {
    // Fetch driver profile - only approved drivers
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('id, full_name, avatar_url, city, driver_status, created_at')
      .eq('id', driverId)
      .eq('driver_status', 'approved')
      .single();

    if (profileError || !profile) {
      return null;
    }

    // Fetch driver documents for vehicle images and verification status
    const { data: documents, error: documentsError } = await this.supabase
      .from('driver_documents')
      .select('vehicle_images, verification_status')
      .eq('driver_id', driverId)
      .maybeSingle();

    const vehicleImages = documents?.vehicle_images || [];
    const verificationStatus = documents?.verification_status || 'pending';

    // Calculate total trips (completed/past rides)
    const now = new Date().toISOString();
    const { count: totalTrips, error: tripsError } = await this.supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .lt('departure_time', now);

    if (tripsError) {
      console.error('Error counting trips:', tripsError);
    }

    // Calculate total passengers (confirmed bookings on completed rides)
    // First, get completed ride IDs for this driver
    const { data: completedRides, error: ridesError } = await this.supabase
      .from('rides')
      .select('id')
      .eq('driver_id', driverId)
      .lt('departure_time', now);

    const completedRideIds = completedRides?.map((r) => r.id) || [];

    // Then, get confirmed bookings for those rides
    let totalPassengers = 0;
    if (completedRideIds.length > 0) {
      const { data: bookingsData, error: bookingsError } = await this.supabase
        .from('bookings')
        .select('seats')
        .in('ride_id', completedRideIds)
        .eq('status', 'confirmed');

      if (bookingsError) {
        console.error('Error fetching bookings:', bookingsError);
      } else {
        totalPassengers =
          bookingsData?.reduce((sum, booking) => sum + (booking.seats || 0), 0) || 0;
      }
    }

    // Format member since date
    const memberSince = profile.created_at
      ? format(new Date(profile.created_at), 'MMMM yyyy')
      : '';

    // Fetch recent rides (last 5 upcoming or recent)
    const { data: recentRides, error: recentRidesError } = await this.supabase
      .from('rides')
      .select('id, from_city, to_city, departure_time, price')
      .eq('driver_id', driverId)
      .order('departure_time', { ascending: false })
      .limit(5);

    if (recentRidesError) {
      console.error('Error fetching recent rides:', recentRidesError);
    }

    const recentRidesFormatted: RidePreview[] =
      recentRides?.map((ride) => ({
        id: ride.id,
        from_city: ride.from_city,
        to_city: ride.to_city,
        departure_time: ride.departure_time,
        price: ride.price,
      })) || [];

    return {
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      city: profile.city,
      driver_status: profile.driver_status,
      created_at: profile.created_at,
      vehicle_images: vehicleImages,
      verification_status: verificationStatus,
      statistics: {
        totalTrips: totalTrips || 0,
        totalPassengers,
        memberSince,
      },
      recentRides: recentRidesFormatted.length > 0 ? recentRidesFormatted : undefined,
    };
  }
}

