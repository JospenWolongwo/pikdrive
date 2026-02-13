'use client';

import { useState } from 'react';
import { ReviewCard } from './review-card';
import { Button } from '@/components/ui';
import { Star, Filter } from 'lucide-react';
import { useLocale } from '@/hooks';
import type { ReviewWithProfiles } from '@/types/review';

interface ReviewListProps {
  readonly reviews: ReviewWithProfiles[];
  readonly onLoadMore?: () => void;
  readonly hasMore?: boolean;
  readonly loading?: boolean;
  readonly showFilters?: boolean;
}

export function ReviewList({
  reviews,
  onLoadMore,
  hasMore = false,
  loading = false,
  showFilters = true,
}: ReviewListProps) {
  const { t } = useLocale();
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const filteredReviews = filterRating
    ? reviews.filter((review) => review.rating === filterRating)
    : reviews;

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {t('reviews.list.noReviews')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      {showFilters && (
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredReviews.length} {t('reviews.list.reviewsCount')}
          </p>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {filterRating ? `${filterRating} ★` : t('reviews.list.filter')}
            </Button>
            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-background border rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    setFilterRating(null);
                    setShowFilterMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-muted rounded-t-lg"
                >
                  {t('reviews.list.allRatings')}
                </button>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => {
                      setFilterRating(rating);
                      setShowFilterMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2"
                  >
                    <span>{rating}</span>
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="text-center mt-6">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? t('reviews.list.loading') : t('reviews.list.loadMore')}
          </Button>
        </div>
      )}

      {/* Empty Filter State */}
      {filteredReviews.length === 0 && filterRating && (
        <div className="text-center py-12">
          <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t('reviews.list.noReviewsWithFilter')}
          </p>
        </div>
      )}
    </div>
  );
}

