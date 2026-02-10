'use client'

// Removed useAuthStore - using useSupabase for auth state
import { Button, Card } from '@/components/ui'
import { toast } from '@/hooks/ui'
import { useRouter } from 'next/navigation'
import { MapPin, Navigation, Phone, Shield, CreditCard, MessageSquare, Star, Users, Clock, ChevronRight, Check, HelpCircle, Building2, Mountain, Waves } from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useSupabase } from '@/providers/SupabaseProvider'
import { handleDriverAction } from '@/lib/driver-routing-utils'
import { useLocale } from "@/hooks";
import { PassengerAdvantages } from '@/components';
import { useEffect, useState } from "react";

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

// Icon mapping function
const getRouteIcon = (iconType: string) => {
  switch (iconType) {
    case 'city':
      return <Building2 className="w-8 h-8 text-blue-600" />;
    case 'mountain':
      return <Mountain className="w-8 h-8 text-green-600" />;
    case 'beach':
      return <Waves className="w-8 h-8 text-cyan-600" />;
    default:
      return <MapPin className="w-8 h-8 text-gray-600" />;
  }
};

export default function Home() {
  const { user, supabase } = useSupabase()
  const router = useRouter()
  const { t } = useLocale()
  const [loadHeroVideo, setLoadHeroVideo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(
        () => setLoadHeroVideo(true),
        { timeout: 1500 }
      );
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const timeout = setTimeout(() => setLoadHeroVideo(true), 1200);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <main className="min-h-screen">
      {/* Hero Section with Background Video/Image */}
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
          {loadHeroVideo && (
            <source src="/hero-background.mp4" type="video/mp4" />
          )}
        </video>
        
        <motion.div 
          className="container relative z-20 text-center text-white"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="block">{t("pages.home.hero.title1")}</span> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-yellow-200">{t("pages.home.hero.title2")}</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed">
            {t("pages.home.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => router.push('/rides')}
              className="bg-primary hover:bg-primary/90"
            >
              {t("pages.home.hero.findRide")}
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
                      title: t("pages.home.toast.information"),
                      description: result.message,
                    })
                  }
                } catch (error) {
                  router.push('/become-driver')
                }
              }}
            >
              {t("pages.home.hero.publishRide")}
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
                <span className="hidden sm:inline">{t("pages.home.hero.contactWhatsApp")}</span>
                <span className="sm:hidden">{t("pages.home.hero.whatsApp")}</span>
              </a>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="bg-white/20 hover:bg-white/30 text-white flex items-center gap-2"
              onClick={() => router.push('/contact')}
            >
              <HelpCircle className="h-5 w-5" />
              <span className="hidden sm:inline">{t("pages.home.hero.needHelp")}</span>
              <span className="sm:hidden">{t("pages.home.hero.help")}</span>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted">
        <div className="container">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 
              variants={fadeIn}
              className="text-3xl md:text-4xl font-bold mb-4 relative inline-block"
            >
              {t("pages.home.howItWorks.title")}
              <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-primary rounded-full"></span>
            </motion.h2>
            <motion.p 
              variants={fadeIn}
              className="text-muted-foreground max-w-2xl mx-auto mt-6 text-lg"
            >
              {t("pages.home.howItWorks.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-4 gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                icon: <MapPin className="w-12 h-12" />,
                title: t("pages.home.howItWorks.step1.title"),
                description: t("pages.home.howItWorks.step1.description")
              },
              {
                icon: <CreditCard className="w-12 h-12" />,
                title: t("pages.home.howItWorks.step2.title"),
                description: t("pages.home.howItWorks.step2.description")
              },
              {
                icon: <Shield className="w-12 h-12" />,
                title: t("pages.home.howItWorks.step3.title"),
                description: t("pages.home.howItWorks.step3.description")
              },
              {
                icon: <Check className="w-12 h-12" />,
                title: t("pages.home.howItWorks.step4.title"),
                description: t("pages.home.howItWorks.step4.description")
              }
            ].map((step, index) => (
              <motion.div
                key={index}
                variants={fadeIn}
                className="bg-background p-8 rounded-lg shadow-lg text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-4">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Passenger Advantages Section */}
      <PassengerAdvantages />

      {/* Popular Routes Section */}
      <section className="py-20">
        <div className="container">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 
              variants={fadeIn}
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              {t("pages.home.popularRoutes.title")}
            </motion.h2>
            <motion.p 
              variants={fadeIn}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              {t("pages.home.popularRoutes.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                from: t("pages.home.popularRoutes.routes.route1.from"),
                to: t("pages.home.popularRoutes.routes.route1.to"),
                price: "5000",
                duration: "4h",
                icon: "city",
                description: t("pages.home.popularRoutes.routes.route1.description")
              },
              {
                from: t("pages.home.popularRoutes.routes.route2.from"),
                to: t("pages.home.popularRoutes.routes.route2.to"),
                price: "4000",
                duration: "3h",
                icon: "mountain",
                description: t("pages.home.popularRoutes.routes.route2.description")
              },
              {
                from: t("pages.home.popularRoutes.routes.route3.from"),
                to: t("pages.home.popularRoutes.routes.route3.to"),
                price: "3500",
                duration: "3h",
                icon: "beach",
                description: t("pages.home.popularRoutes.routes.route3.description")
              }
            ].map((route, index) => (
              <motion.div
                key={index}
                variants={fadeIn}
                className="group cursor-pointer"
                onClick={() => router.push('/rides')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 bg-gradient-to-br from-card to-card/50">
                  {/* Dynamic Background Pattern */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full"></div>
                  
                  <div className="relative p-6">
                    {/* Route Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
                          {getRouteIcon(route.icon)}
                        </div>
                    <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("pages.home.popularRoutes.popularRoute")}</p>
                          <h3 className="text-lg font-bold text-foreground">{route.from} → {route.to}</h3>
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center group-hover:animate-pulse">
                        <ChevronRight className="w-6 h-6 text-primary-foreground" />
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed">{route.description}</p>
                      
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-secondary/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-primary to-amber-500 rounded-full flex items-center justify-center">
                            <Clock className="w-4 h-4 text-primary-foreground" />
                          </div>
                    <div>
                            <p className="text-xs text-muted-foreground font-medium">{t("pages.home.popularRoutes.duration")}</p>
                            <p className="font-bold text-foreground">{route.duration}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-medium">{t("pages.home.popularRoutes.averagePrice")}</p>
                          <div className="flex items-baseline gap-1">
                            <p className="text-xl font-black text-primary">{route.price}</p>
                            <p className="text-xs font-bold text-muted-foreground">{t("pages.home.popularRoutes.currency")}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Hover Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-muted">
        <div className="container">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.h2 
              variants={fadeIn}
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              {t("pages.home.testimonials.title")}
            </motion.h2>
            <motion.p 
              variants={fadeIn}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              {t("pages.home.testimonials.subtitle")}
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              {
                name: t("pages.home.testimonials.testimonial1.name"),
                role: t("pages.home.testimonials.testimonial1.role"),
                image: "/testimonials/user1.jpg",
                comment: t("pages.home.testimonials.testimonial1.comment"),
                rating: 5,
                verified: true
              },
              {
                name: t("pages.home.testimonials.testimonial2.name"),
                role: t("pages.home.testimonials.testimonial2.role"),
                image: "/testimonials/user2.jpg",
                comment: t("pages.home.testimonials.testimonial2.comment"),
                rating: 5,
                verified: true
              },
              {
                name: t("pages.home.testimonials.testimonial3.name"),
                role: t("pages.home.testimonials.testimonial3.role"),
                image: "/testimonials/user3.jpg",
                comment: t("pages.home.testimonials.testimonial3.comment"),
                rating: 5,
                verified: true
              }
            ].map((testimonial, index) => (
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
                className="bg-background p-8 rounded-lg shadow-lg relative"
              >
                {testimonial.verified && (
                  <div className="absolute top-4 right-4 text-primary">
                    <Shield className="w-5 h-5" />
                  </div>
                )}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10">
                      <Image 
                        src={testimonial.image} 
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                        width={64}
                        height={64}
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
                      className={`w-5 h-5 ${
                        star <= testimonial.rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <motion.p 
                  className="text-muted-foreground mb-4 italic"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  &ldquo;{testimonial.comment}&rdquo;
                </motion.p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
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
                {t("pages.home.cta.title")}
              </h2>
              <p className="text-lg mb-8 text-white/90">
                {t("pages.home.cta.subtitle", { count: "15,000+" })}
              </p>
              <div className="flex flex-wrap gap-4">
                {!user && (
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => router.push('/auth')}
                    className="whitespace-nowrap"
                  >
                    {t("pages.home.cta.createAccount")}
                  </Button>
                )}
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-primary border-primary dark:text-white dark:border-white hover:bg-primary hover:text-white dark:hover:bg-white dark:hover:text-primary"
                  onClick={() => router.push('/rides')}
                >
                  {t("pages.home.cta.findRide")}
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
                    {["/testimonials/user1.jpg", "/testimonials/user2.jpg", "/testimonials/user3.jpg"].map((src, i) => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden">
                        <Image src={src} alt={t("pages.home.cta.user")} width={40} height={40} className="object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">{t("pages.home.cta.joinUsers", { count: "15K+" })}</div>
                </div>
                
                <div className="space-y-3 mb-4">
                  {[
                    t("pages.home.cta.features.booking"),
                    t("pages.home.cta.features.payment"),
                    t("pages.home.cta.features.verification"),
                    t("pages.home.cta.features.support")
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="bg-green-500 rounded-full p-1 mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-white/20">
                  <div className="text-sm mb-1">{t("pages.home.cta.comingSoon")}</div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="border-primary/50 text-primary dark:border-white/30 dark:text-white hover:bg-primary/10 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white">
                      {t("pages.home.cta.appInDevelopment")}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  )
}
