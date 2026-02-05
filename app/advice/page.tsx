'use client'

import { motion } from 'framer-motion'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Card } from '@/components/ui'
import { Shield, AlertTriangle, HelpCircle, PhoneCall, Mail, Clock, MapPin, CreditCard, CheckCircle, Smartphone, AlertCircle, WifiOff, Truck, Network } from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'
import { useLocale } from "@/hooks";

export default function AdvicePage() {
  const { t } = useLocale()
  const safetyTips = [
    {
      title: t("pages.advice.safetyTips.verifyDriver.title"),
      content: t("pages.advice.safetyTips.verifyDriver.content"),
      icon: Shield,
    },
    {
      title: t("pages.advice.safetyTips.shareTrip.title"),
      content: t("pages.advice.safetyTips.shareTrip.content"),
      icon: AlertTriangle,
    },
    {
      title: t("pages.advice.safetyTips.stayPublic.title"),
      content: t("pages.advice.safetyTips.stayPublic.content"),
      icon: Shield,
    },
    {
      title: t("pages.advice.safetyTips.keepCodeSecret.title"),
      content: t("pages.advice.safetyTips.keepCodeSecret.content"),
      icon: AlertCircle,
    },
  ]

  const faqs = [
    {
      question: t("pages.advice.faq.howWorks.question"),
      answer: t("pages.advice.faq.howWorks.answer"),
    },
    {
      question: t("pages.advice.faq.howBook.question"),
      answer: t("pages.advice.faq.howBook.answer"),
    },
    {
      question: t("pages.advice.faq.verificationCode.question"),
      answer: t("pages.advice.faq.verificationCode.answer"),
    },
    {
      question: t("pages.advice.faq.offline.question"),
      answer: t("pages.advice.faq.offline.answer"),
    },
    {
      question: t("pages.advice.faq.driverCancel.question"),
      answer: t("pages.advice.faq.driverCancel.answer"),
    },
    {
      question: t("pages.advice.faq.becomeDriver.question"),
      answer: t("pages.advice.faq.becomeDriver.answer"),
    },
    {
      question: t("pages.advice.faq.paymentSecure.question"),
      answer: t("pages.advice.faq.paymentSecure.answer"),
    },
  ]

  return (
    <main className="min-h-screen py-20">
      {/* Comment ça marche Section */}
      <section className="container mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">{t("pages.advice.howItWorks.title")}</h1>
          <p className="text-muted-foreground text-lg">{t("pages.advice.howItWorks.subtitle")}</p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {[
            {
              icon: <MapPin className="w-12 h-12" />,
              title: t("pages.advice.howItWorks.step1.title"),
              description: t("pages.advice.howItWorks.step1.description"),
            },
            {
              icon: <CreditCard className="w-12 h-12" />,
              title: t("pages.advice.howItWorks.step2.title"),
              description: t("pages.advice.howItWorks.step2.description"),
            },
            {
              icon: <Smartphone className="w-12 h-12" />,
              title: t("pages.advice.howItWorks.step3.title"),
              description: t("pages.advice.howItWorks.step3.description"),
            },
            {
              icon: <CheckCircle className="w-12 h-12" />,
              title: t("pages.advice.howItWorks.step4.title"),
              description: t("pages.advice.howItWorks.step4.description"),
            }
          ].map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 h-full">
                <div className="mb-4 flex justify-center">
                  <div className="text-primary">{step.icon}</div>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-center">{step.title}</h3>
                <p className="text-muted-foreground text-center">{step.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="bg-primary/10 rounded-lg p-6 mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">{t("pages.advice.whyCode.title")}</h2>
          <p className="text-center max-w-3xl mx-auto mb-6">
            {t("pages.advice.whyCode.description")}
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="bg-background rounded p-4 text-center">
              <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">{t("pages.advice.whyCode.securePayment")}</h3>
              <p className="text-sm text-muted-foreground">{t("pages.advice.whyCode.securePaymentDesc")}</p>
            </div>
            <div className="bg-background rounded p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">{t("pages.advice.whyCode.antiFraud")}</h3>
              <p className="text-sm text-muted-foreground">{t("pages.advice.whyCode.antiFraudDesc")}</p>
            </div>
            <div className="bg-background rounded p-4 text-center">
              <Network className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">{t("pages.advice.whyCode.offline")}</h3>
              <p className="text-sm text-muted-foreground">{t("pages.advice.whyCode.offlineDesc")}</p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">{t("pages.advice.safetyTipsTitle")}</h2>
        <div className="grid md:grid-cols-2 gap-6">
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

      {/* Common Problems Section */}
      <section className="container mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">{t("pages.advice.commonProblems.title")}</h2>
          <p className="text-muted-foreground text-lg">{t("pages.advice.commonProblems.subtitle")}</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: <WifiOff className="w-8 h-8" />,
              title: t("pages.advice.commonProblems.connectionIssues.title"),
              content: t("pages.advice.commonProblems.connectionIssues.content")
            },
            {
              icon: <Truck className="w-8 h-8" />,
              title: t("pages.advice.commonProblems.badRoads.title"),
              content: t("pages.advice.commonProblems.badRoads.content")
            },
            {
              icon: <AlertCircle className="w-8 h-8" />,
              title: t("pages.advice.commonProblems.checkpoints.title"),
              content: t("pages.advice.commonProblems.checkpoints.content")
            },
            {
              icon: <Clock className="w-8 h-8" />,
              title: t("pages.advice.commonProblems.delays.title"),
              content: t("pages.advice.commonProblems.delays.content")
            },
            {
              icon: <CreditCard className="w-8 h-8" />,
              title: t("pages.advice.commonProblems.paymentIssues.title"),
              content: t("pages.advice.commonProblems.paymentIssues.content")
            }
          ].map((issue, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 h-full">
                <div className="flex items-center mb-4">
                  <div className="p-2 rounded-full bg-primary/10 mr-3">
                    <div className="text-primary">{issue.icon}</div>
                  </div>
                  <h3 className="text-lg font-semibold">{issue.title}</h3>
                </div>
                <p className="text-muted-foreground">{issue.content}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">{t("pages.advice.faqTitle")}</h2>
          <p className="text-muted-foreground text-lg">{t("pages.advice.faq.subtitle")}</p>
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
          <h2 className="text-4xl font-bold mb-4">{t("pages.advice.contact.title")}</h2>
          <p className="text-muted-foreground text-lg">{t("pages.advice.contact.subtitle")}</p>
        </motion.div>

        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mx-auto max-w-6xl px-4">
            <Card className="p-6 text-center">
              <PhoneCall className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">{t("pages.advice.contact.callUs")}</h3>
              <a 
                href="tel:+237621793423" 
                className="text-muted-foreground break-words hover:text-primary transition-colors"
              >
                +237 6 21 79 34 23
              </a>
            </Card>
            
            <Card className="p-6 text-center">
              <BsWhatsapp className="w-8 h-8 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">{t("pages.advice.contact.whatsapp")}</h3>
              <a 
                href="https://wa.me/+237621793423" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground break-words hover:text-green-500 transition-colors"
              >
                +237 6 21 79 34 23
              </a>
            </Card>

            <Card className="p-6 text-center">
              <Mail className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">{t("pages.advice.contact.email")}</h3>
              <a 
                href="mailto:support@pikdrive.com"
                className="text-muted-foreground break-words hover:text-primary transition-colors"
              >
                support@pikdrive.com
              </a>
            </Card>

            <Card className="p-6 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">{t("pages.advice.contact.openingHours")}</h3>
              <p className="text-muted-foreground">{t("pages.advice.contact.openingHoursValue")}</p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
