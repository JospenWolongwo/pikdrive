'use client'

import { motion } from 'framer-motion'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { Shield, AlertTriangle, HelpCircle, PhoneCall, Mail } from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'

export default function AdvicePage() {
  const safetyTips = [
    {
      title: "Verify Driver Identity",
      content: "Always check that the driver's profile picture and vehicle details match what you see in person.",
      icon: Shield,
    },
    {
      title: "Share Your Trip",
      content: "Use our 'Share Trip' feature to let friends or family track your journey in real-time.",
      icon: AlertTriangle,
    },
    {
      title: "Stay in Public Areas",
      content: "For pickups and drop-offs, stick to well-lit, public locations whenever possible.",
      icon: Shield,
    },
  ]

  const faqs = [
    {
      question: "How do I book a ride?",
      answer: "You can book a ride by visiting our 'Find Rides' page, selecting your destination and preferred time, then choosing from available drivers. Follow the booking process and wait for driver confirmation."
    },
    {
      question: "What happens if my driver cancels?",
      answer: "If your driver cancels, you'll be notified immediately and can either choose another available driver or request a full refund."
    },
    {
      question: "How can I become a driver?",
      answer: "Visit our 'Become a Driver' page to start the application process. You'll need to provide valid identification, vehicle documentation, and pass our safety verification process."
    },
    {
      question: "Is my payment secure?",
      answer: "Yes, we use industry-standard encryption for all transactions. Your payment details are never stored on our servers."
    },
  ]

  return (
    <main className="min-h-screen py-20">
      {/* Safety Tips Section */}
      <section className="container mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Safety First</h1>
          <p className="text-muted-foreground text-lg">Your safety is our top priority. Follow these guidelines for a secure journey.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {safetyTips.map((tip, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6">
                <div className="mb-4">
                  <tip.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{tip.title}</h3>
                <p className="text-muted-foreground">{tip.content}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-lg">Find answers to common questions about using PikDrive.</p>
        </motion.div>

        <Accordion type="single" collapsible className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Contact Section */}
      <section className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold mb-4">Need Help?</h2>
          <p className="text-muted-foreground text-lg">Our support team is always ready to assist you.</p>
        </motion.div>

        <div className="flex justify-center gap-6">
          <Card className="p-6 text-center">
            <PhoneCall className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Call Us</h3>
            <p className="text-muted-foreground">+237 YOUR_PHONE</p>
          </Card>
          
          <Card className="p-6 text-center">
            <BsWhatsapp className="w-8 h-8 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">WhatsApp</h3>
            <p className="text-muted-foreground">+237 YOUR_PHONE</p>
          </Card>

          <Card className="p-6 text-center">
            <Mail className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Email</h3>
            <p className="text-muted-foreground">support@pikdrive.com</p>
          </Card>
        </div>
      </section>
    </main>
  )
}
