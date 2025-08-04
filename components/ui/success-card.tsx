import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Clock, ClipboardCheck, Mail, Phone } from "lucide-react"

export interface SuccessStep {
  number: number
  title: string
  description: string
}

export interface SuccessCardProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  status?: {
    text: string
    description: string
    variant?: 'pending' | 'success' | 'warning'
  }
  steps?: SuccessStep[]
  contactInfo?: {
    email?: string
    phone?: string
    supportText?: string
  }
  actions?: {
    primary?: {
      text: string
      href: string
    }
    secondary?: {
      text: string
      href: string
    }
  }
  bilingualText?: {
    title?: string
    subtitle?: string
  }
  carImage?: string
  className?: string
}

export function SuccessCard({
  title,
  subtitle,
  icon = <CheckCircle2 className="w-12 h-12 text-green-600" />,
  status,
  steps,
  contactInfo,
  actions,
  bilingualText,
  carImage,
  className = ""
}: SuccessCardProps) {
  const getStatusStyles = (variant: string = 'pending') => {
    switch (variant) {
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800'
      default:
        return 'border-amber-200 bg-amber-50 text-amber-800'
    }
  }

  const getStatusIcon = (variant: string = 'pending') => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="text-green-500 w-5 h-5 flex-shrink-0" />
      case 'warning':
        return <Clock className="text-yellow-500 w-5 h-5 flex-shrink-0" />
      default:
        return <Clock className="text-amber-500 w-5 h-5 flex-shrink-0" />
    }
  }

  return (
    <div className="container py-16 flex flex-col items-center">
      <Card className={`max-w-2xl w-full p-8 border-2 border-primary/10 ${className}`}>
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            {icon}
          </div>
          
          {/* Car Image - Beautiful minimalistic display */}
          {carImage && (
            <div className="w-full max-w-xs mx-auto">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                <div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/20 shadow-lg">
                  <div className="aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    <img 
                      src={carImage} 
                      alt="Véhicule du conducteur"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.src = '/defaults/car-placeholder.svg'
                      }}
                    />
                  </div>
                  <div className="mt-3 text-center">
                    <p className="text-sm font-medium text-gray-700">Votre véhicule</p>
                    <p className="text-xs text-gray-500">Prêt pour les trajets</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
            {subtitle && (
              <p className="text-gray-600 max-w-md">{subtitle}</p>
            )}
          </div>

          {/* Status Card */}
          {status && (
            <div className={`w-full p-4 border rounded-lg flex items-center gap-3 ${getStatusStyles(status.variant)}`}>
              {getStatusIcon(status.variant)}
              <div className="flex-1">
                <p className="text-sm font-medium">{status.text}</p>
                <p className="text-xs opacity-80">{status.description}</p>
              </div>
            </div>
          )}
          
          {/* Steps */}
          {steps && steps.length > 0 && (
            <div className="w-full text-left space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                What happens next?
              </h2>
              
              <ul className="space-y-3">
                {steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-primary">{step.number}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-gray-600">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Contact Info */}
          {contactInfo && (
            <div className="w-full text-left p-4 border rounded-lg bg-gray-50">
              <p className="text-sm">
                <span className="font-medium">{contactInfo.supportText || "Have questions?"}</span>
                {contactInfo.email && (
                  <> Contact our support team at 
                    <a href={`mailto:${contactInfo.email}`} className="text-primary hover:underline"> {contactInfo.email}</a>
                  </>
                )}
                {contactInfo.phone && (
                  <> or call 
                    <a href={`tel:${contactInfo.phone}`} className="text-primary hover:underline"> {contactInfo.phone}</a>
                  </>
                )}
              </p>
            </div>
          )}
          
          {/* Actions */}
          {actions && (
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              {actions.primary && (
                <Button asChild className="flex-1">
                  <Link href={actions.primary.href}>{actions.primary.text}</Link>
                </Button>
              )}
              {actions.secondary && (
                <Button asChild variant="outline" className="flex-1">
                  <Link href={actions.secondary.href}>{actions.secondary.text}</Link>
                </Button>
              )}
            </div>
          )}
          
          {/* Bilingual section */}
          {bilingualText && (
            <div className="border-t pt-4 text-sm text-gray-500 w-full">
              {bilingualText.title && <p className="font-medium">{bilingualText.title}</p>}
              {bilingualText.subtitle && <p>{bilingualText.subtitle}</p>}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
} 