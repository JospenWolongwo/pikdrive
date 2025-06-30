"use client"

import { Car, CheckCircle2, DollarSign, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"

// Requirements section as a separate component
export function DriverRequirements() {
  const requirements = [
    {
      icon: <Car className="w-6 h-6 text-primary" />,
      title: "Documents Véhicule Requis",
      items: [
        "Carte Grise du Véhicule (Recto/Verso)",
        "Certificat d'Assurance (Recto/Verso)"
      ]
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-primary" />,
      title: "Documents Conducteur Requis",
      items: [
        "Carte Nationale d'Identité (Recto/Verso)",
        "Permis de Conduire (Recto/Verso)"
      ]
    },
    {
      icon: <DollarSign className="w-6 h-6 text-primary" />,
      title: "Avantages",
      items: [
        "Gagnez plus avec les trajets longue distance",
        "Paiements hebdomadaires",
        "Horaires flexibles",
        "Assistance 24/7"
      ]
    }
  ]

  return (
    <div className="grid gap-8 md:grid-cols-3">
      {requirements.map((section, index) => (
        <Card key={index} className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {section.icon}
              <h3 className="font-semibold">{section.title}</h3>
            </div>
            <ul className="space-y-2">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-1 text-primary" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  )
}
