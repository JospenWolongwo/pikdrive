"use client";

import { Button } from "@/components/ui"
import Link from "next/link"
import { useLocale } from "@/hooks"

export default function OfflinePage() {
  const { t } = useLocale();
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">{t("offline.title")}</h1>
        <p className="text-gray-600">
          {t("offline.description")}
        </p>
        <Button asChild>
          <Link href="/">{t("offline.tryAgain")}</Link>
        </Button>
      </div>
    </div>
  )
}
