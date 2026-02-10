'use client'

import { Button } from '@/components/ui'
import { toast } from '@/hooks/ui'
import { useRouter } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'
import { motion } from 'framer-motion'
import { useSupabase } from '@/providers/SupabaseProvider'
import { handleDriverAction } from '@/lib/driver-routing-utils'
import { useLocale } from '@/hooks'
import { useEffect, useState } from 'react'

export function HomeHeroSection() {
  const { user, supabase } = useSupabase()
  const router = useRouter()
  const { t } = useLocale()
  const [loadHeroVideo, setLoadHeroVideo] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if ('requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }).requestIdleCallback(
        () => setLoadHeroVideo(true),
        { timeout: 1500 }
      )
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
    }

    const timeout = setTimeout(() => setLoadHeroVideo(true), 1200)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <section className="relative h-[90vh] flex items-center justify-center bg-gradient-to-r from-primary to-primary-foreground overflow-hidden">
      <div className="absolute inset-0 bg-black/50 z-10" />
      <video
        autoPlay={loadHeroVideo}
        loop
        muted
        playsInline
        preload="none"
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      >
        {loadHeroVideo && <source src="/hero-background.mp4" type="video/mp4" />}
      </video>

      <motion.div
        className="container relative z-20 text-center text-white"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="block">{t('pages.home.hero.title1')}</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-yellow-200">
            {t('pages.home.hero.title2')}
          </span>
        </h1>
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed">
          {t('pages.home.hero.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => router.push('/rides')}
            className="bg-primary hover:bg-primary/90"
          >
            {t('pages.home.hero.findRide')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="bg-white/10 hover:bg-white/20 border-white"
            onClick={async () => {
              if (!user) {
                router.push('/auth?redirect=/')
                return
              }

              try {
                const result = await handleDriverAction(supabase, user.id, router)
                if (result.message) {
                  toast({
                    title: t('pages.home.toast.information'),
                    description: result.message
                  })
                }
              } catch (error) {
                router.push('/become-driver')
              }
            }}
          >
            {t('pages.home.hero.publishRide')}
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="bg-green-500/90 hover:bg-green-500 text-white flex items-center gap-2"
            asChild
          >
            <a href="https://wa.me/+237621793423" target="_blank" rel="noopener noreferrer">
              <BsWhatsapp className="h-5 w-5" />
              <span className="hidden sm:inline">{t('pages.home.hero.contactWhatsApp')}</span>
              <span className="sm:hidden">{t('pages.home.hero.whatsApp')}</span>
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white flex items-center gap-2"
            onClick={() => router.push('/contact')}
          >
            <HelpCircle className="h-5 w-5" />
            <span className="hidden sm:inline">{t('pages.home.hero.needHelp')}</span>
            <span className="sm:hidden">{t('pages.home.hero.help')}</span>
          </Button>
        </div>
      </motion.div>
    </section>
  )
}

