import { PassengerAdvantages } from '@/components'
import { HomeHeroSection } from '@/components/home/home-hero-section'
import { HomeHowItWorksSection } from '@/components/home/home-how-it-works-section'
import { HomePopularRoutesSection } from '@/components/home/home-popular-routes-section'
import { HomeTestimonialsSection } from '@/components/home/home-testimonials-section'
import { HomeCtaSection } from '@/components/home/home-cta-section'

export default function Home() {
  return (
    <main className="min-h-screen">
      <HomeHeroSection />
      <HomeHowItWorksSection />
      <PassengerAdvantages />
      <HomePopularRoutesSection />
      <HomeTestimonialsSection />
      <HomeCtaSection />
    </main>
  )
}

