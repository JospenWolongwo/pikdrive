"use client";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { Suspense, useEffect } from 'react';
import { BookingsList } from './bookings-list';
import { PageLoader } from '@/components/ui/page-loader';
import { ContentLoader } from '@/components/ui/content-loader';
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
    return <PageLoader message={t("pages.bookings.loading")} />;
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
