import { Star, Shield } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useLocale } from '@/hooks';
import type { ReviewWithProfiles } from '@/types/review';
import Image from 'next/image';

interface ReviewCardProps {
  readonly review: ReviewWithProfiles;
  readonly compact?: boolean;
}

export function ReviewCard({ review, compact = false }: ReviewCardProps) {
  const { locale } = useLocale();
  const dateLocale = locale === 'fr' ? fr : enUS;

  const renderStars = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= review.rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const timeAgo = formatDistanceToNow(new Date(review.created_at), {
    addSuffix: true,
    locale: dateLocale,
  });

  return (
    <div className={`bg-background rounded-lg border shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      {/* Reviewer Info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full overflow-hidden bg-muted`}>
              {review.reviewer.avatar_url ? (
                <Image
                  src={review.reviewer.avatar_url}
                  alt={review.reviewer.full_name}
                  width={compact ? 40 : 48}
                  height={compact ? 40 : 48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-semibold">
                  {review.reviewer.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>
                {review.reviewer.full_name}
              </p>
              {review.is_verified && (
                <Shield className="h-4 w-4 text-primary" title="Verified ride" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
        {renderStars()}
      </div>

      {/* Route Info */}
      {review.ride && (
        <div className="mb-3 text-sm text-muted-foreground">
          {review.ride.from_city} → {review.ride.to_city}
        </div>
      )}

      {/* Comment */}
      {review.comment && (
        <p className={`text-foreground ${compact ? 'text-sm' : 'text-base'} mb-3`}>
          {review.comment}
        </p>
      )}

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground"
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
