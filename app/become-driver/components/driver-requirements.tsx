"use client"

import { Car, CheckCircle2, DollarSign, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui"
import { useLocale } from "@/hooks"

// Requirements section as a separate component
export function DriverRequirements() {
  const { t } = useLocale();
  
  const requirements = [
    {
      icon: <Car className="w-6 h-6 text-primary" />,
      title: t("pages.becomeDriver.requirements.vehicleDocuments.title"),
      items: [
        t("pages.becomeDriver.requirements.vehicleDocuments.items.registration"),
        t("pages.becomeDriver.requirements.vehicleDocuments.items.insurance")
      ]
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-primary" />,
      title: t("pages.becomeDriver.requirements.driverDocuments.title"),
      items: [
        t("pages.becomeDriver.requirements.driverDocuments.items.nationalId"),
        t("pages.becomeDriver.requirements.driverDocuments.items.license")
      ]
    },
    {
      icon: <DollarSign className="w-6 h-6 text-primary" />,
      title: t("pages.becomeDriver.requirements.advantages.title"),
      items: [
        t("pages.becomeDriver.requirements.advantages.items.instantPayouts"),
        t("pages.becomeDriver.requirements.advantages.items.reducedRisk"),
        t("pages.becomeDriver.requirements.advantages.items.flexibleHours"),
        t("pages.becomeDriver.requirements.advantages.items.support247")
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
