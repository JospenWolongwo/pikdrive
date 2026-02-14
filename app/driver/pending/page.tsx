'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/SupabaseProvider'
import { useRouter } from 'next/navigation'
import { Clock, CheckCircle, X, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge, Button } from '@/components/ui'
import { useLocale } from '@/hooks'
import {
  PendingStatusCard,
  NextStepsCard,
  ImportantInfoCard,
  PendingActionButtons,
} from './components'

interface DriverStatus {
  readonly driver_status: string
  readonly driver_application_status: string
  readonly is_driver_applicant: boolean
}

export default function DriverPendingPage() {
  const { user, supabase } = useSupabase()
  const { t } = useLocale()
  const router = useRouter()
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/auth?redirect=/driver/pending')
      return
    }

    loadDriverStatus()
  }, [user, router])

  const loadDriverStatus = async () => {
    try {
      setLoading(true)
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('driver_status, driver_application_status, is_driver_applicant')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setDriverStatus(profile)
    } catch (error) {
      console.error('Error loading driver status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user || loading) {
    return (
      <div className="container py-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t("pages.driver.pending.loading")}</p>
        </div>
      </div>
    )
  }

  if (!driverStatus?.is_driver_applicant) {
    return (
      <div className="container py-10">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">{t("pages.driver.pending.noApplication.title")}</h1>
          <p className="text-muted-foreground mb-6">
            {t("pages.driver.pending.noApplication.description")}
          </p>
          <Button onClick={() => router.push('/become-driver')}>
            {t("pages.driver.pending.noApplication.button")}
          </Button>
        </div>
      </div>
    )
  }

  const isRejected = driverStatus.driver_status === 'rejected'
  const isPending = driverStatus.driver_status === 'pending'
  const isApproved = driverStatus.driver_status === 'approved'

  return (
    <div className="container py-10">
      <div className="max-w-2xl mx-auto">
        <PendingHeader
          isRejected={isRejected}
          isPending={isPending}
          isApproved={isApproved}
          t={t}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <PendingStatusCard isRejected={isRejected} isApproved={isApproved} isPending={isPending} t={t} />

          {(isPending || isApproved) && (
            <NextStepsCard isPending={isPending} t={t} />
          )}

          <ImportantInfoCard isRejected={isRejected} t={t} />
          <PendingActionButtons isRejected={isRejected} isApproved={isApproved} t={t} />
        </motion.div>
      </div>
    </div>
  )
}

function PendingHeader({ isRejected, isPending, isApproved, t }: {
  readonly isRejected: boolean
  readonly isPending: boolean
  readonly isApproved: boolean
  readonly t: (key: string) => string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center mb-8"
    >
      <div className="relative mb-6">
        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${
          isRejected 
            ? 'bg-gradient-to-br from-red-100 to-red-200' 
            : isApproved 
            ? 'bg-gradient-to-br from-green-100 to-green-200'
            : 'bg-gradient-to-br from-primary/10 to-accent/20'
        }`}>
          {isRejected ? (
            <X className="w-12 h-12 text-red-600" />
          ) : isApproved ? (
            <CheckCircle className="w-12 h-12 text-green-600" />
          ) : (
            <Clock className="w-12 h-12 text-primary" />
          )}
        </div>
        {isPending && (
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <RefreshCw className="w-4 w-4 text-primary-foreground animate-spin" />
          </div>
        )}
      </div>
      
      <h1 className="text-3xl font-bold mb-4">
        {isRejected 
          ? t('pages.driver.pending.rejectedTitle')
          : isApproved 
          ? t('pages.driver.pending.approvedTitle')
          : t('pages.driver.pending.title')
        }
      </h1>
      <p className="text-muted-foreground text-lg">
        {isRejected 
          ? t('pages.driver.pending.rejectedDescription')
          : isApproved 
          ? t('pages.driver.pending.approvedDescription')
          : t('pages.driver.pending.description')
        }
      </p>

      <div className="mt-4">
        <Badge className={`${
          isRejected 
            ? 'bg-red-100 text-red-800 border-red-200' 
            : isApproved 
            ? 'bg-green-100 text-green-800 border-green-200'
            : 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }`}>
          {isRejected 
            ? t("pages.driver.pending.status.rejected")
            : isApproved 
            ? t("pages.driver.pending.status.approved")
            : t("pages.driver.pending.status.pending")
          }
        </Badge>
      </div>
    </motion.div>
  )
}
