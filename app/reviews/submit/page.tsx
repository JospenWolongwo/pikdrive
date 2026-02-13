'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui';
import { ReviewSubmitForm } from './review-submit-form';

function ReviewSubmitSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-background rounded-lg shadow-lg p-6 md:p-8">
          {/* Header skeleton */}
          <div className="text-center mb-8">
            <Skeleton className="h-8 w-48 mx-auto mb-3" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>

          {/* Booking info skeleton */}
          <div className="bg-muted rounded-lg p-4 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>

          {/* Star rating skeleton */}
          <div className="mb-6">
            <Skeleton className="h-4 w-48 mb-3" />
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-12 rounded-full" />
              ))}
            </div>
          </div>

          {/* Tags skeleton */}
          <div className="mb-6">
            <Skeleton className="h-4 w-32 mb-3" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-24 rounded-full" />
              ))}
            </div>
          </div>

          {/* Comment skeleton */}
          <div className="mb-6">
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>

          {/* Button skeleton */}
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ReviewSubmitPage() {
  return (
    <Suspense fallback={<ReviewSubmitSkeleton />}>
      <ReviewSubmitForm />
    </Suspense>
  );
}
