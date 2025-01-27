'use client'

import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { MapPin, Navigation, Phone, Shield, CreditCard, MessageSquare, Star, Users, Clock, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'

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

export default function Home() {
  const { user } = useAuth()
  const router = useRouter()

  return (
    <main className="min-h-screen">
      {/* Hero Section with Background Video/Image */}
      <section className="relative h-[90vh] flex items-center justify-center bg-gradient-to-r from-primary to-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-black/50 z-10" />
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero-background.mp4" type="video/mp4" />
        </video>
        
        <motion.div 
          className="container relative z-20 text-center text-white"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Travel Smarter, Together
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto">
            Your trusted ride companion for intercity travel in Cameroon
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => router.push('/rides')}
              className="bg-primary hover:bg-primary/90"
            >
              Find a Ride
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="bg-white/10 hover:bg-white/20 border-white"
              onClick={() => router.push('/become-driver')}
            >
              Become a Driver
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
              className="text-3xl md:text-4xl font-bold mb-4"
            >
              How It Works
            </motion.h2>
            <motion.p 
              variants={fadeIn}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Getting started with Wakayamo is easy as 1-2-3
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
                icon: <MapPin className="w-12 h-12" />,
                title: "Choose Your Destination",
                description: "Select where you want to go from our popular routes"
              },
              {
                icon: <Users className="w-12 h-12" />,
                title: "Book Your Seat",
                description: "Reserve your spot with our verified drivers"
              },
              {
                icon: <Clock className="w-12 h-12" />,
                title: "Enjoy Your Ride",
                description: "Sit back and enjoy a comfortable journey"
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
              Popular Routes
            </motion.h2>
            <motion.p 
              variants={fadeIn}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Discover our most traveled intercity routes
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
                from: "Douala",
                to: "Yaoundé",
                price: "5000",
                duration: "4h"
              },
              {
                from: "Yaoundé",
                to: "Bafoussam",
                price: "4000",
                duration: "3h"
              },
              {
                from: "Douala",
                to: "Kribi",
                price: "3500",
                duration: "3h"
              }
            ].map((route, index) => (
              <motion.div
                key={index}
                variants={fadeIn}
                className="group cursor-pointer"
                onClick={() => router.push('/rides')}
              >
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">From</p>
                      <h3 className="text-lg font-semibold">{route.from}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">To</p>
                      <h3 className="text-lg font-semibold">{route.to}</h3>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{route.duration}</span>
                    <span>{route.price} FCFA</span>
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
              What Our Users Say
            </motion.h2>
            <motion.p 
              variants={fadeIn}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Don't just take our word for it
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
                name: "Jean Paul",
                role: "Regular Traveler",
                comment: "The best way to travel between cities. Safe and reliable!"
              },
              {
                name: "Marie Claire",
                role: "Business Traveler",
                comment: "Perfect for my weekly trips to Yaoundé. Always on time!"
              },
              {
                name: "Emmanuel",
                role: "Student",
                comment: "Affordable and comfortable. Great for weekend trips home!"
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                variants={fadeIn}
                className="bg-background p-8 rounded-lg shadow-lg"
              >
                <div className="flex items-center mb-4">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <Star className="w-5 h-5 text-yellow-400" />
                  <Star className="w-5 h-5 text-yellow-400" />
                  <Star className="w-5 h-5 text-yellow-400" />
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-muted-foreground mb-4">{testimonial.comment}</p>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied travelers who trust Wakayamo for their intercity journeys
            </p>
            {!user && (
              <Button
                size="lg"
                variant="secondary"
                onClick={() => router.push('/auth')}
              >
                Sign Up Now
              </Button>
            )}
          </motion.div>
        </div>
      </section>
    </main>
  )
}