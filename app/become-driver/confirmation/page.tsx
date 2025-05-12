"use client"

import Link from "next/link"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, ClipboardCheck, Clock } from "lucide-react"

export default function ApplicationConfirmationPage() {
  // Log page view for analytics
  useEffect(() => {
    console.log("📊 Driver Application Confirmation Page Viewed")
  }, [])

  return (
    <div className="container py-16 flex flex-col items-center">
      <Card className="max-w-2xl w-full p-8 border-2 border-primary/10">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-800">Application Submitted!</h1>
            <p className="text-gray-600 max-w-md">
              Thank you for applying to become a PikDrive driver.
            </p>
          </div>

          {/* Status Card */}
          <div className="w-full p-4 border border-amber-200 rounded-lg bg-amber-50 flex items-center gap-3">
            <Clock className="text-amber-500 w-5 h-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Your application is pending review</p>
              <p className="text-xs text-gray-600">Our team typically reviews applications within 24-48 hours</p>
            </div>
          </div>
          
          {/* Details */}
          <div className="w-full text-left space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              What happens next?
            </h2>
            
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">1</span>
                </div>
                <p className="text-sm">Our team will review your documents and verify your information</p>
              </li>
              
              <li className="flex gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">2</span>
                </div>
                <p className="text-sm">You'll receive an email notification once your application is approved</p>
              </li>
              
              <li className="flex gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-primary">3</span>
                </div>
                <p className="text-sm">After approval, you can start accepting ride requests through your driver dashboard</p>
              </li>
            </ul>
          </div>
          
          {/* Contact Info */}
          <div className="w-full text-left p-4 border rounded-lg bg-gray-50">
            <p className="text-sm">
              <span className="font-medium">Have questions?</span> Contact our driver support team at 
              <a href="mailto:support@pikdrive.com" className="text-primary hover:underline"> support@pikdrive.com</a> 
              or call <a href="tel:+123456789" className="text-primary hover:underline">+123 456 789</a>
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Button asChild className="flex-1">
              <Link href="/">Return to Home Page</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/bookings">View My Bookings</Link>
            </Button>
          </div>
          
          {/* Bilingual section */}
          <div className="border-t pt-4 text-sm text-gray-500 w-full">
            <p>
              Votre demande a été soumise avec succès et est en cours d&apos;examen. 
              Nous vous informerons par e-mail une fois qu&apos;elle sera approuvée.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
