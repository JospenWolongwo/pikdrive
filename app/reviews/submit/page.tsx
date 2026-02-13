'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Star, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useLocale } from '@/hooks';
import { REVIEW_TAGS, type ReviewEligibility } from '@/types/review';

export default function ReviewSubmitPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();
  const bookingId = searchParams.get('booking_id');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tag options based on reviewee type
  const tagOptions = eligibility?.booking?.reviewee_type === 'driver'
    ? [
        { value: REVIEW_TAGS.PUNCTUAL, label: t('reviews.tags.punctual') },
        { value: REVIEW_TAGS.FRIENDLY, label: t('reviews.tags.friendly') },
        { value: REVIEW_TAGS.CLEAN_CAR, label: t('reviews.tags.cleanCar') },
        { value: REVIEW_TAGS.SAFE_DRIVER, label: t('reviews.tags.safeDriver') },
        { value: REVIEW_TAGS.PROFESSIONAL, label: t('reviews.tags.professional') },
      ]
    : [
        { value: REVIEW_TAGS.RESPECTFUL, label: t('reviews.tags.respectful') },
        { value: REVIEW_TAGS.ON_TIME, label: t('reviews.tags.onTime') },
        { value: REVIEW_TAGS.GOOD_COMMUNICATION, label: t('reviews.tags.goodCommunication') },
        { value: REVIEW_TAGS.PLEASANT, label: t('reviews.tags.pleasant') },
      ];

  useEffect(() => {
    if (!bookingId) {
      setError('Booking ID is required');
      setLoading(false);
      return;
    }

    // Check eligibility
    fetch(`/api/reviews/check-eligibility/${bookingId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setEligibility(data.data);
          if (!data.data.canReview) {
            setError(data.data.reason || 'Cannot review this booking');
          }
        } else {
          setError('Failed to check eligibility');
        }
      })
      .catch(() => {
        setError('Failed to load booking information');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [bookingId]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError(t('reviews.submit.errors.ratingRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId,
          rating,
          comment: comment.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || t('reviews.submit.errors.failed'));
      }
    } catch (err) {
      setError(t('reviews.submit.errors.network'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('reviews.submit.loading')}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('reviews.submit.success.title')}</h1>
          <p className="text-muted-foreground mb-6">
            {t('reviews.submit.success.description')}
          </p>
          <Button onClick={() => router.push('/bookings')} className="w-full">
            {t('reviews.submit.success.backToBookings')}
          </Button>
        </div>
      </div>
    );
  }

  if (error || !eligibility?.canReview || !eligibility.booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <div className="max-w-md w-full bg-background rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-2 text-destructive">
            {t('reviews.submit.error.title')}
          </h1>
          <p className="text-muted-foreground mb-6">
            {error || t('reviews.submit.error.description')}
          </p>
          <Button onClick={() => router.push('/bookings')} variant="outline" className="w-full">
            {t('reviews.submit.error.backToBookings')}
          </Button>
        </div>
      </div>
    );
  }

  const { booking } = eligibility;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-background rounded-lg shadow-lg p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {t('reviews.submit.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('reviews.submit.subtitle')}
            </p>
          </div>

          {/* Booking Info */}
          <div className="bg-muted rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {t('reviews.submit.reviewingLabel')}
              </span>
              <span className="font-semibold">{booking.reviewee_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t('reviews.submit.routeLabel')}
              </span>
              <span className="font-semibold">{booking.route}</span>
            </div>
          </div>

          {/* Review Form */}
          <form onSubmit={handleSubmit}>
            {/* Star Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                {t('reviews.submit.ratingLabel')} <span className="text-destructive">*</span>
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-12 w-12 ${
                        star <= (hoveredRating || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-center mt-2 text-sm text-muted-foreground">
                  {rating === 5 && t('reviews.submit.ratings.excellent')}
                  {rating === 4 && t('reviews.submit.ratings.good')}
                  {rating === 3 && t('reviews.submit.ratings.average')}
                  {rating === 2 && t('reviews.submit.ratings.poor')}
                  {rating === 1 && t('reviews.submit.ratings.veryPoor')}
                </p>
              )}
            </div>

            {/* Quick Tags */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                {t('reviews.submit.tagsLabel')} <span className="text-muted-foreground text-xs">({t('reviews.submit.optional')})</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    onClick={() => handleTagToggle(tag.value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag.value)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                {t('reviews.submit.commentLabel')} <span className="text-muted-foreground text-xs">({t('reviews.submit.optional')})</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                placeholder={t('reviews.submit.commentPlaceholder')}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">
                {comment.length}/500
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || rating === 0}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t('reviews.submit.submitting')}
                </>
              ) : (
                t('reviews.submit.submitButton')
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
