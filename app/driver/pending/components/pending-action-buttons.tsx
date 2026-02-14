'use client'

import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui'

interface PendingActionButtonsProps {
  readonly isRejected: boolean
  readonly isApproved: boolean
  readonly t: (key: string) => string
}

export function PendingActionButtons({ isRejected, isApproved, t }: PendingActionButtonsProps) {
  const router = useRouter()

  if (isRejected) {
    return (
      <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <Button onClick={() => router.push('/become-driver')} className="flex-1">
          <Shield className="w-4 h-4 mr-2" />
          {t("pages.driver.pending.actions.applyAgain")}
        </Button>
        <Button onClick={() => router.push('/contact')} variant="outline" className="flex-1">
          {t("pages.driver.pending.actions.contactSupport")}
        </Button>
      </div>
    )
  }

  if (isApproved) {
    return (
      <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <Button onClick={() => router.push('/driver/dashboard')} className="flex-1">
          <Shield className="w-4 h-4 mr-2" />
          {t("pages.driver.pending.actions.accessDashboard")}
        </Button>
        <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
          {t("pages.driver.pending.actions.goHome")}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 pt-6">
      <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
        {t("pages.driver.pending.actions.goHome")}
      </Button>
      <Button onClick={() => router.push('/contact')} className="flex-1">
        {t("pages.driver.pending.actions.contactSupport")}
      </Button>
    </div>
  )
}
