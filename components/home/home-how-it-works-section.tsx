'use client'

import { motion } from 'framer-motion'
import { MapPin, CreditCard, Shield, Check } from 'lucide-react'
import { useLocale } from '@/hooks'

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

export function HomeHowItWorksSection() {
  const { t } = useLocale()

  const steps = [
    {
      icon: <MapPin className="w-12 h-12" />,
      title: t('pages.home.howItWorks.step1.title'),
      description: t('pages.home.howItWorks.step1.description')
    },
    {
      icon: <CreditCard className="w-12 h-12" />,
      title: t('pages.home.howItWorks.step2.title'),
      description: t('pages.home.howItWorks.step2.description')
    },
    {
      icon: <Shield className="w-12 h-12" />,
      title: t('pages.home.howItWorks.step3.title'),
      description: t('pages.home.howItWorks.step3.description')
    },
    {
      icon: <Check className="w-12 h-12" />,
      title: t('pages.home.howItWorks.step4.title'),
      description: t('pages.home.howItWorks.step4.description')
    }
  ]

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
            className="text-3xl md:text-4xl font-bold mb-4 relative inline-block"
          >
            {t('pages.home.howItWorks.title')}
            <span className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-primary rounded-full"></span>
          </motion.h2>
          <motion.p
            variants={fadeIn}
            className="text-muted-foreground max-w-2xl mx-auto mt-6 text-lg"
          >
            {t('pages.home.howItWorks.subtitle')}
          </motion.p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
        >
          {steps.map((step, index) => (
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
  )
}

