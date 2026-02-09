import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickupPoint } from '@/types';
import { BookingApiError } from './booking-errors';

export async function getBookingOrThrow<T = any>(
  supabase: SupabaseClient,
  bookingId: string,
  select: string
): Promise<T> {
  const { data, error } = await supabase
    .from('bookings')
    .select(select)
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    throw new BookingApiError('Booking not found', 404);
  }

  return data as T;
}

export async function assertOwnerOrDriver(
  supabase: SupabaseClient,
  booking: { user_id?: string; ride_id?: string | null },
  userId: string
): Promise<void> {
  if (booking.user_id === userId) return;

  if (booking.ride_id) {
    const { data: ride } = await supabase
      .from('rides')
      .select('driver_id')
      .eq('id', booking.ride_id)
      .single();

    if (ride?.driver_id === userId) return;
  }

  throw new BookingApiError('Not authorized to access this booking', 403);
}

export function assertOwner(
  booking: { user_id?: string },
  userId: string
): void {
  if (booking.user_id !== userId) {
    throw new BookingApiError('Not authorized to access this booking', 403);
  }
}

/**
 * Validate and calculate pickup point information
 */
export async function validateAndCalculatePickupPoint(
  supabase: SupabaseClient,
  rideId: string,
  selectedPickupPointId: string | undefined
): Promise<{ pickup_point_name?: string; pickup_time?: string } | null> {
  if (!selectedPickupPointId) {
    return null;
  }

  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .select('departure_time, pickup_points')
    .eq('id', rideId)
    .single();

  if (rideError || !ride) {
    throw new Error('Ride not found');
  }

  let pickupPoints: PickupPoint[] | undefined;
  if (ride.pickup_points) {
    try {
      pickupPoints =
        typeof ride.pickup_points === 'string'
          ? JSON.parse(ride.pickup_points)
          : ride.pickup_points;
    } catch (e) {
      console.error('Error parsing pickup_points:', e);
      throw new Error('Invalid pickup points data in ride');
    }
  }

  if (!pickupPoints || pickupPoints.length === 0) {
    throw new Error('Ride has no pickup points defined');
  }

  const selectedPoint = pickupPoints.find((p) => p.id === selectedPickupPointId);
  if (!selectedPoint) {
    throw new Error('Selected pickup point not found in ride');
  }

  let pickupPointName = selectedPoint.name?.trim();
  if (!pickupPointName) {
    const { data: row } = await supabase
      .from('city_pickup_points')
      .select('name')
      .eq('id', selectedPoint.id)
      .single();
    pickupPointName = (row as { name?: string } | null)?.name ?? '';
  }

  const departureTime = new Date(ride.departure_time);
  const pickupTimeDate = new Date(
    departureTime.getTime() + selectedPoint.time_offset_minutes * 60 * 1000
  );

  return {
    pickup_point_name: pickupPointName,
    pickup_time: pickupTimeDate.toISOString(),
  };
}
