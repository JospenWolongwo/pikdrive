"use client"

import { SuccessCard } from "@/components/ui"
import { useLocale } from "@/hooks"

export default function ApplicationConfirmationPage() {
  const { t } = useLocale();

  return (
    <SuccessCard
      title={t("pages.becomeDriver.confirmation.title")}
      subtitle={t("pages.becomeDriver.confirmation.subtitle")}
      status={{
        text: t("pages.becomeDriver.confirmation.status.text"),
        description: t("pages.becomeDriver.confirmation.status.description"),
        variant: "pending" as const
      }}
      steps={[
        {
          number: 1,
          title: t("pages.becomeDriver.confirmation.steps.step1.title"),
          description: t("pages.becomeDriver.confirmation.steps.step1.description")
        },
        {
          number: 2,
          title: t("pages.becomeDriver.confirmation.steps.step2.title"),
          description: t("pages.becomeDriver.confirmation.steps.step2.description")
        },
        {
          number: 3,
          title: t("pages.becomeDriver.confirmation.steps.step3.title"),
          description: t("pages.becomeDriver.confirmation.steps.step3.description")
        }
      ]}
      contactInfo={{
        email: "support@pikdrive.com",
        phone: "+237 6 21 79 34 23",
        supportText: t("pages.becomeDriver.confirmation.contact.supportText")
      }}
      actions={{
        primary: {
          text: t("pages.becomeDriver.confirmation.actions.primary.text"),
          href: "/"
        },
        secondary: {
          text: t("pages.becomeDriver.confirmation.actions.secondary.text"),
          href: "/bookings"
        }
      }}
      bilingualText={{
        subtitle: t("pages.becomeDriver.confirmation.bilingualText.subtitle")
      }}
    />
  )
}
