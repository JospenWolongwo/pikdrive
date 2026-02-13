'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Shield, Star } from 'lucide-react'
import { useLocale } from '@/hooks'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui'
import type { ReviewWithProfiles } from '@/types/review'

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.2
    }
  }
}

const AUTOPLAY_DELAY_MS = 4500

type Testimonial = {
  name: string
  role: string
  image: string
  comment: string
  rating: number
  verified: boolean
}

function TestimonialCard({
  testimonial,
  compact = false
}: {
  testimonial: Testimonial
  compact?: boolean
}) {
  return (
    <div className={`bg-background rounded-lg shadow-lg relative h-full ${compact ? 'p-6' : 'p-8'}`}>
      {testimonial.verified && (
        <div className="absolute top-4 right-4 text-primary">
          <Shield className="w-5 h-5" />
        </div>
      )}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <div className={`${compact ? 'w-14 h-14' : 'w-16 h-16'} rounded-full overflow-hidden bg-primary/10`}>
            <Image
              src={testimonial.image}
              alt={testimonial.name}
              className="w-full h-full object-cover"
              width={compact ? 56 : 64}
              height={compact ? 56 : 64}
              onError={(e) => {
                // @ts-ignore - Next Image doesn't have src property on e.currentTarget
                e.currentTarget.src = '/defaults/avatar.svg'
              }}
            />
          </div>
        </div>
        <div>
          <p className="font-semibold">{testimonial.name}</p>
          <p className="text-sm text-muted-foreground">{testimonial.role}</p>
        </div>
      </div>
      <div className="flex items-center mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${star <= testimonial.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
          />
        ))}
      </div>
      {compact ? (
        <p className="text-sm text-muted-foreground italic">&ldquo;{testimonial.comment}&rdquo;</p>
      ) : (
        <motion.p
          className="text-muted-foreground mb-4 italic"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          &ldquo;{testimonial.comment}&rdquo;
        </motion.p>
      )}
    </div>
  )
}

export function HomeTestimonialsSection() {
  const { t } = useLocale()
  const [testimonialsApi, setTestimonialsApi] = useState<CarouselApi>()
  const [testimonialsCurrent, setTestimonialsCurrent] = useState(0)
  const [testimonialsCount, setTestimonialsCount] = useState(0)
  const [isAutoplayPaused, setIsAutoplayPaused] = useState(false)
  const [realReviews, setRealReviews] = useState<ReviewWithProfiles[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)

  // Fetch real reviews on mount
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        // Fetch latest 5-star verified reviews
        const response = await fetch('/api/reviews?rating=5&limit=5')
        const data = await response.json()

        if (data.success && data.data) {
          const reviews = data.data.filter((review: ReviewWithProfiles) => 
            review.is_verified && review.comment && review.comment.length > 20
          )
          setRealReviews(reviews)
        }
      } catch (err) {
        console.error('Error fetching reviews:', err)
      } finally {
        setReviewsLoading(false)
      }
    }

    fetchReviews()
  }, [])

  // Featured testimonials (handpicked)
  const featuredTestimonials: Testimonial[] = [
    {
      name: t('pages.home.testimonials.testimonial1.name'),
      role: t('pages.home.testimonials.testimonial1.role'),
      image: '/testimonials/user1.jpg',
      comment: t('pages.home.testimonials.testimonial1.comment'),
      rating: 5,
      verified: true
    },
    {
      name: t('pages.home.testimonials.testimonial2.name'),
      role: t('pages.home.testimonials.testimonial2.role'),
      image: '/testimonials/user2.jpg',
      comment: t('pages.home.testimonials.testimonial2.comment'),
      rating: 5,
      verified: true
    }
  ]

  // Convert real reviews to testimonial format
  const realReviewsAsTestimonials: Testimonial[] = realReviews.map(review => ({
    name: review.reviewer.full_name,
    role: review.reviewer_type === 'passenger' ? 'Passager vérifié' : 'Conducteur vérifié',
    image: review.reviewer.avatar_url || '/defaults/avatar.svg',
    comment: review.comment || '',
    rating: review.rating,
    verified: review.is_verified
  }))

  // Combine featured and real reviews (max 6 total)
  const testimonials = [...featuredTestimonials, ...realReviewsAsTestimonials].slice(0, 6)

  useEffect(() => {
    if (!testimonialsApi) return

    const onSelect = () => setTestimonialsCurrent(testimonialsApi.selectedScrollSnap())

    setTestimonialsCount(testimonialsApi.scrollSnapList().length)
    onSelect()

    testimonialsApi.on('select', onSelect)
    testimonialsApi.on('reInit', onSelect)

    return () => {
      testimonialsApi.off('select', onSelect)
      testimonialsApi.off('reInit', onSelect)
    }
  }, [testimonialsApi])

  useEffect(() => {
    if (!testimonialsApi || testimonialsCount <= 1 || isAutoplayPaused) return

    const intervalId = window.setInterval(() => {
      if (testimonialsApi.canScrollNext()) {
        testimonialsApi.scrollNext()
      } else {
        testimonialsApi.scrollTo(0)
      }
    }, AUTOPLAY_DELAY_MS)

    return () => window.clearInterval(intervalId)
  }, [testimonialsApi, testimonialsCount, isAutoplayPaused])

  const pauseAutoplay = () => setIsAutoplayPaused(true)
  const resumeAutoplay = () => setIsAutoplayPaused(false)

  return (
    <section className="py-12 md:py-20 bg-muted">
      <div className="container">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="text-center mb-8 md:mb-12"
        >
          <motion.h2
            variants={fadeIn}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            {t('pages.home.testimonials.title')}
          </motion.h2>
          <motion.p
            variants={fadeIn}
            className="text-muted-foreground max-w-2xl mx-auto"
          >
            {t('pages.home.testimonials.subtitle')}
          </motion.p>
        </motion.div>

        <div
          className="md:hidden"
          onMouseEnter={pauseAutoplay}
          onMouseLeave={resumeAutoplay}
          onTouchStart={pauseAutoplay}
          onTouchEnd={resumeAutoplay}
          onTouchCancel={resumeAutoplay}
          onFocusCapture={pauseAutoplay}
          onBlurCapture={resumeAutoplay}
        >
          <Carousel
            setApi={setTestimonialsApi}
            opts={{ align: 'start', loop: true }}
            className="-mx-1"
          >
            <CarouselContent>
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index} className="basis-[92%] pl-4">
                  <TestimonialCard testimonial={testimonial} compact />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: testimonialsCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => testimonialsApi?.scrollTo(index)}
                className="p-1"
                aria-label={`Go to testimonial ${index + 1}`}
                aria-current={testimonialsCurrent === index ? 'true' : undefined}
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    testimonialsCurrent === index ? 'w-6 bg-primary' : 'w-1.5 bg-primary/30'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <motion.div
          className="hidden md:grid md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.5,
                    delay: index * 0.2
                  }
                }
              }}
              whileHover={{ y: -5 }}
            >
              <TestimonialCard testimonial={testimonial} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

