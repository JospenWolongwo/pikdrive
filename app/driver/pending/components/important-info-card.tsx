'use client'

import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

interface ImportantInfoCardProps {
  readonly isRejected: boolean
  readonly t: (key: string) => string
}

export function ImportantInfoCard({ isRejected, t }: ImportantInfoCardProps) {
  return (
    <Card className={`border-2 ${
      isRejected 
        ? 'border-red-200 bg-gradient-to-br from-red-50 to-red-100' 
        : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50'
    }`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${
          isRejected ? 'text-red-800' : 'text-amber-800'
        }`}>
          <AlertCircle className="w-5 h-5" />
          {isRejected 
            ? t("pages.driver.pending.important.titleRejected") 
            : t("pages.driver.pending.important.titlePending")
          }
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isRejected ? (
          <RejectedInfo t={t} />
        ) : (
          <PendingInfo t={t} />
        )}
      </CardContent>
    </Card>
  )
}

function RejectedInfo({ t }: { readonly t: (key: string) => string }) {
  return (
    <>
      <p className="text-sm text-red-700">
        • {t("pages.driver.pending.important.rejected.checkDocuments")}
      </p>
      <p className="text-sm text-red-700">
        • {t("pages.driver.pending.important.rejected.checkInfo")}
      </p>
      <p className="text-sm text-red-700">
        • {t("pages.driver.pending.important.rejected.checkVehicle")}
      </p>
      <p className="text-sm text-red-700">
        • {t("pages.driver.pending.important.rejected.contactSupport")}
      </p>
    </>
  )
}

function PendingInfo({ t }: { readonly t: (key: string) => string }) {
  return (
    <>
      <p className="text-sm text-amber-700">
        • {t("pages.driver.pending.important.pending.checkDocuments")}
      </p>
      <p className="text-sm text-amber-700">
        • {t("pages.driver.pending.important.pending.checkEmail")}
      </p>
      <p className="text-sm text-amber-700">
        • {t("pages.driver.pending.important.pending.contactSupport")}
      </p>
    </>
  )
}
