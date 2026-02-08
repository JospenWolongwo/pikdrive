"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { Suspense, useEffect } from 'react';
import { BookingsList } from './bookings-list';
import { ContentLoader, Skeleton } from '@/components/ui';
import { useSupabase } from '@/providers/SupabaseProvider';
import { useRouter } from 'next/navigation';
import { CalendarCheck } from 'lucide-react';
import { useLocale } from "@/hooks";

interface BookingsPageProps {
  searchParams: {
    page?: string;
  };
}

function BookingsPageContent({ searchParams }: BookingsPageProps) {
  const { user, loading } = useSupabase();
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    if (!loading && !user) {
      console.error("BookingsPage: No authenticated user found");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>

        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center space-x-3">
          <CalendarCheck className="w-8 h-8 text-blue-600" />
          <span>{t("pages.bookings.title")}</span>
        </h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>{t("pages.bookings.title")} :</strong> {t("pages.bookings.description")}
        </p>
      </div>

      <Suspense fallback={<ContentLoader size="lg" message={t("pages.bookings.loading")} />}>
        <BookingsList page={searchParams.page ? parseInt(searchParams.page) : 1} />
      </Suspense>
    </div>
  );
}

export default function BookingsPage({ searchParams }: BookingsPageProps) {
  return <BookingsPageContent searchParams={searchParams} />;
}
