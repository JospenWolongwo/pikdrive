"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { Suspense } from 'react';
import { BookingsList } from './bookings-list';
import { LoadingBookings } from './loading';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface BookingsPageProps {
  searchParams: {
    page?: string;
  };
}

function BookingsPageContent({ searchParams }: BookingsPageProps) {
  const { user, loading } = useSupabase();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      console.error("🚫 BookingsPage: No authenticated user found");
    }
  }, [user, loading]);

  if (loading) {
    return <LoadingBookings />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Mes Réservations</h1>
      <Suspense fallback={<LoadingBookings />}>
        <BookingsList page={searchParams.page ? parseInt(searchParams.page) : 1} />
      </Suspense>
    </div>
  );
}

export default function BookingsPage({ searchParams }: BookingsPageProps) {
  return <BookingsPageContent searchParams={searchParams} />;
}
