import { Star } from 'lucide-react';
import { useLocale } from '@/hooks';
import type { ReviewStatistics } from '@/types/review';

interface RatingSummaryProps {
  readonly statistics: ReviewStatistics;
  readonly compact?: boolean;
}

export function RatingSummary({ statistics, compact = false }: RatingSummaryProps) {
  const { t } = useLocale();

  const { average_rating, total_reviews, rating_distribution } = statistics;

  const getPercentage = (count: number) => {
    if (total_reviews === 0) return 0;
    return Math.round((count / total_reviews) * 100);
  };

  if (total_reviews === 0) {
    return (
      <div className="text-center py-8">
        <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {t('reviews.summary.noReviews')}
        </p>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'p-4' : 'p-6'} bg-background rounded-lg border`}>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Average Rating */}
        <div className="flex flex-col items-center justify-center md:w-1/3">
          <div className={`${compact ? 'text-4xl' : 'text-5xl'} font-bold mb-2`}>
            {average_rating.toFixed(1)}
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} ${
                  star <= Math.round(average_rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {total_reviews} {t('reviews.summary.reviewsLabel')}
          </p>
        </div>

        {/* Rating Distribution */}
        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = rating_distribution[rating as keyof typeof rating_distribution];
            const percentage = getPercentage(count);

            return (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12">
                  <span className="text-sm">{rating}</span>
                  <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                </div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm text-muted-foreground">
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
