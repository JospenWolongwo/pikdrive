'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, Input, Button, Textarea, useToast } from '@/components/ui'
import { Phone, Mail, MapPin, Send, Loader2 } from 'lucide-react'
import { useLocale } from "@/hooks";

export default function ContactPage() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { t } = useLocale()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500))

    toast({
      title: t("pages.contact.toast.sent"),
      description: t("pages.contact.toast.sentDescription"),
    })

    setIsLoading(false)
    ;(e.target as HTMLFormElement).reset()
  }

  const contactInfo = [
    {
      icon: Phone,
      title: t("pages.contact.phone"),
      details: ["+237 6 21 79 34 23"],
    },
    {
      icon: Mail,
      title: t("pages.contact.email"),
      details: ["support@pikdrive.com", "info@pikdrive.com"],
    },
    {
      icon: MapPin,
      title: t("pages.contact.office"),
      details: ["Silicon Mountain", "Buea, Cameroun"],
    },
  ]

  return (
    <main className="min-h-screen py-20">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            {t("pages.contact.title")}
          </h1>
          <p className="text-xl text-muted-foreground">
            {t("pages.contact.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            <div className="space-y-6">
              {contactInfo.map((item, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">{item.title}</h3>
                      {item.details.map((detail, i) => (
                        <p key={i} className="text-muted-foreground">
                          {detail}
                        </p>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">{t("pages.contact.hours.title")}</h3>
              <div className="space-y-2 text-muted-foreground">
                <p>{t("pages.contact.hours.weekdays")}</p>
                <p>{t("pages.contact.hours.saturday")}</p>
                <p>{t("pages.contact.hours.sunday")}</p>
              </div>
            </Card>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm font-medium">
                      {t("pages.contact.form.firstName")}
                    </label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm font-medium">
                      {t("pages.contact.form.lastName")}
                    </label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    {t("pages.contact.form.email")}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium">
                    {t("pages.contact.form.phone")}
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="621793423"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    {t("pages.contact.form.message")}
                  </label>
                  <Textarea
                    id="message"
                    placeholder={t("pages.contact.form.messagePlaceholder")}
                    required
                    disabled={isLoading}
                    className="min-h-[150px]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("pages.contact.form.sending")}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t("pages.contact.form.send")}
                    </>
                  )}
                </Button>
              </form>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  )
}