"use client"

import { useEffect } from "react"
import { SuccessCard } from "@/components/ui/success-card"

export default function ApplicationConfirmationPage() {
  // Log page view for analytics
  useEffect(() => {
    console.log("📊 Driver Application Confirmation Page Viewed")
  }, [])

  return (
    <SuccessCard
      title="Candidature Soumise !"
      subtitle="Merci d'avoir postulé pour devenir conducteur PikDrive."
      status={{
        text: "Votre candidature est en cours d'examen",
        description: "Notre équipe examine généralement les candidatures sous 24-48 heures",
        variant: "pending"
      }}
      steps={[
        {
          number: 1,
          title: "Examen des Documents",
          description: "Notre équipe examinera vos documents et vérifiera vos informations"
        },
        {
          number: 2,
          title: "Notification par Email",
          description: "Vous recevrez une notification par email une fois votre candidature approuvée"
        },
        {
          number: 3,
          title: "Commencer à Conduire",
          description: "Après approbation, vous pourrez accepter des demandes de trajet via votre tableau de bord"
        }
      ]}
      contactInfo={{
        email: "support@pikdrive.com",
        phone: "+237 698 805 890",
        supportText: "Des questions ?"
      }}
      actions={{
        primary: {
          text: "Retour à l'Accueil",
          href: "/"
        },
        secondary: {
          text: "Mes Réservations",
          href: "/bookings"
        }
      }}
      bilingualText={{
        subtitle: "Votre demande a été soumise avec succès et est en cours d'examen. Nous vous informerons par e-mail une fois qu'elle sera approuvée."
      }}
    />
  )
}
