export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { Suspense } from 'react';
import { BookingsList } from './bookings-list';
import { LoadingBookings } from './loading';

interface BookingsPageProps {
  searchParams: {
    page?: string;
  };
}

export default function BookingsPage({ searchParams }: BookingsPageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Bookings</h1>
      <Suspense fallback={<LoadingBookings />}>
        <BookingsList page={searchParams.page ? parseInt(searchParams.page) : 1} />
      </Suspense>
    </div>
  )
}
