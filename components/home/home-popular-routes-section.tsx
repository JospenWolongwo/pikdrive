'use client'

import { motion } from 'framer-motion'
import { useLocale } from '@/hooks'
import { Card } from '@/components/ui'
import { useRouter } from 'next/navigation'
import { Building2, Mountain, Waves, MapPin, ChevronRight, Clock } from 'lucide-react'
import Image from 'next/image'

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

const getRouteIcon = (iconType: string) => {
  switch (iconType) {
    case 'city':
      return <Building2 className="w-8 h-8 text-blue-600" />
    case 'mountain':
      return <Mountain className="w-8 h-8 text-green-600" />
    case 'beach':
      return <Waves className="w-8 h-8 text-cyan-600" />
    default:
      return <MapPin className="w-8 h-8 text-gray-600" />
  }
}

export function HomePopularRoutesSection() {
  const { t } = useLocale()
  const router = useRouter()

  const routes = [
    {
      from: t('pages.home.popularRoutes.routes.route1.from'),
      to: t('pages.home.popularRoutes.routes.route1.to'),
      price: '5000',
      duration: '4h',
      icon: 'city',
      description: t('pages.home.popularRoutes.routes.route1.description'),
      image: '/images/towns/douala-yaounde.jpg'
    },
    {
      from: t('pages.home.popularRoutes.routes.route2.from'),
      to: t('pages.home.popularRoutes.routes.route2.to'),
      price: '4000',
      duration: '3h',
      icon: 'mountain',
      description: t('pages.home.popularRoutes.routes.route2.description'),
      image: '/images/towns/yaounde-bafoussam.jpg'
    },
    {
      from: t('pages.home.popularRoutes.routes.route3.from'),
      to: t('pages.home.popularRoutes.routes.route3.to'),
      price: '3500',
      duration: '3h',
      icon: 'beach',
      description: t('pages.home.popularRoutes.routes.route3.description'),
      image: '/images/towns/douala-kribi.jpg'
    }
  ]

  return (
    <section className="py-12 md:py-20">
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
            {t('pages.home.popularRoutes.title')}
          </motion.h2>
          <motion.p
            variants={fadeIn}
            className="text-muted-foreground max-w-2xl mx-auto"
          >
            {t('pages.home.popularRoutes.subtitle')}
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {routes.map((route, index) => (
            <motion.div
              key={index}
              variants={fadeIn}
              className="group cursor-pointer"
              onClick={() => router.push('/rides')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 bg-gradient-to-br from-card to-card/50">
                {/* Dynamic background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full"></div>

                <div className="relative p-6">
                  <div className="relative h-40 rounded-xl overflow-hidden mb-5">
                    <Image
                      src={route.image}
                      alt={`${route.from} ${t('pages.home.popularRoutes.popularRoute')}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 90vw, 30vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-3 left-3 w-10 h-10 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md">
                      {getRouteIcon(route.icon)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {t('pages.home.popularRoutes.popularRoute')}
                      </p>
                      <h3 className="text-lg font-bold text-foreground">
                        {route.from} &rarr; {route.to}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center group-hover:animate-pulse">
                      <ChevronRight className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{route.description}</p>

                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-secondary/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center">
                          <Clock className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{t('pages.home.popularRoutes.duration')}</p>
                          <p className="font-bold text-foreground">{route.duration}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-muted-foreground font-medium">{t('pages.home.popularRoutes.averagePrice')}</p>
                        <div className="flex items-baseline gap-1">
                          <p className="text-xl font-black text-primary">{route.price}</p>
                          <p className="text-xs font-bold text-muted-foreground">{t('pages.home.popularRoutes.currency')}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
