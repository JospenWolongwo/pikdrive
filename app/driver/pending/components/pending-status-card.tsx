'use client'

import { Clock, CheckCircle, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'

interface PendingStatusCardProps {
  readonly isRejected: boolean
  readonly isApproved: boolean
  readonly isPending: boolean
  readonly t: (key: string) => string
}

export function PendingStatusCard({ isRejected, isApproved, isPending, t }: PendingStatusCardProps) {
  return (
    <Card className={`border-2 ${
      isRejected 
        ? 'border-red-200 bg-gradient-to-br from-red-50 to-red-100' 
        : isApproved 
        ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100'
        : 'border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5'
    }`}>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${
          isRejected 
            ? 'text-red-800' 
            : isApproved 
            ? 'text-green-800'
            : 'text-primary'
        }`}>
          {isRejected ? (
            <X className="w-5 h-5" />
          ) : isApproved ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
          {t("pages.driver.pending.statusCard.title")}
        </CardTitle>
        <CardDescription>
          {isRejected 
            ? t("pages.driver.pending.statusCard.rejectedDescription")
            : isApproved 
            ? t("pages.driver.pending.statusCard.approvedDescription")
            : t("pages.driver.pending.statusCard.pendingDescription")
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRejected ? (
          <RejectedContent t={t} />
        ) : isApproved ? (
          <ApprovedContent t={t} />
        ) : (
          <PendingContent t={t} />
        )}
      </CardContent>
    </Card>
  )
}

function RejectedContent({ t }: { readonly t: (key: string) => string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-red-100 rounded-lg">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <span className="font-medium text-red-800">{t("pages.driver.pending.rejected.badge")}</span>
      </div>
      <div className="bg-white p-4 rounded-lg border border-red-200">
        <h4 className="font-semibold text-red-800 mb-2">{t("pages.driver.pending.rejected.possibleReasons")}</h4>
        <ul className="text-sm text-red-700 space-y-1">
          <li>• {t("pages.driver.pending.rejected.reasons.incompleteDocuments")}</li>
          <li>• {t("pages.driver.pending.rejected.reasons.incorrectInfo")}</li>
          <li>• {t("pages.driver.pending.rejected.reasons.expiredDocuments")}</li>
          <li>• {t("pages.driver.pending.rejected.reasons.drivingHistory")}</li>
        </ul>
      </div>
      <p className="text-sm text-red-700">
        <strong>{t("pages.driver.pending.rejected.note")}</strong>
      </p>
    </div>
  )
}

function ApprovedContent({ t }: { readonly t: (key: string) => string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg">
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        <span className="font-medium text-green-800">{t("pages.driver.pending.approved.badge")}</span>
      </div>
      <p className="text-sm text-green-700">
        {t("pages.driver.pending.approved.congratulations")}
      </p>
    </div>
  )
}

function PendingContent({ t }: { readonly t: (key: string) => string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
        <span className="font-medium">{t("pages.driver.pending.pendingStatus.badge")}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("pages.driver.pending.pendingStatus.typicalTime")}
      </p>
    </div>
  )
}
