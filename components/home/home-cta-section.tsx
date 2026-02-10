'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { useLocale } from '@/hooks'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/providers/SupabaseProvider'

export function HomeCtaSection() {
  const { user } = useSupabase()
  const { t } = useLocale()
  const router = useRouter()

  const ctaFeatures = [
    t('pages.home.cta.features.booking'),
    t('pages.home.cta.features.payment'),
    t('pages.home.cta.features.verification'),
    t('pages.home.cta.features.support')
  ]

  return (
    <section className="py-24 bg-gradient-to-r from-primary to-primary-foreground text-white">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="md:w-1/2 text-left"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
              {t('pages.home.cta.title')}
            </h2>
            <p className="text-lg mb-8 text-white/90">
              {t('pages.home.cta.subtitle', { count: '15,000+' })}
            </p>
            <div className="flex flex-wrap gap-4">
              {!user && (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => router.push('/auth')}
                  className="whitespace-nowrap"
                >
                  {t('pages.home.cta.createAccount')}
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="text-primary border-primary dark:text-white dark:border-white hover:bg-primary hover:text-white dark:hover:bg-white dark:hover:text-primary"
                onClick={() => router.push('/rides')}
              >
                {t('pages.home.cta.findRide')}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="md:w-1/2 relative"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex -space-x-2">
                  {['/testimonials/user1.jpg', '/testimonials/user2.jpg', '/testimonials/user3.jpg'].map((src, i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                      <Image src={src} alt={t('pages.home.cta.user')} width={40} height={40} className="object-cover" />
                    </div>
                  ))}
                </div>
                <div className="text-sm">{t('pages.home.cta.joinUsers', { count: '15K+' })}</div>
              </div>

              <div className="space-y-3 mb-4">
                {ctaFeatures.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="bg-green-500 rounded-full p-1 mt-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white/20">
                <div className="text-sm mb-1">{t('pages.home.cta.comingSoon')}</div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/50 text-primary dark:border-white/30 dark:text-white hover:bg-primary/10 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {t('pages.home.cta.appInDevelopment')}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

