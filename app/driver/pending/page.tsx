'use client'

import { useEffect, useState } from 'react'
// Removed useAuthStore - using useSupabase for auth state
import { useSupabase } from '@/providers/SupabaseProvider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle, AlertCircle, RefreshCw, X, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { useLocale } from '@/hooks'

interface DriverStatus {
  driver_status: string
  driver_application_status: string
  is_driver_applicant: boolean
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

          {/* Status Badge */}
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          {/* Status Card */}
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
              ) : isApproved ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-800">{t("pages.driver.pending.approved.badge")}</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {t("pages.driver.pending.approved.congratulations")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                    <span className="font-medium">{t("pages.driver.pending.pendingStatus.badge")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.driver.pending.pendingStatus.typicalTime")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps Card - Only show for pending and approved */}
          {(isPending || isApproved) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  {t("pages.driver.pending.nextSteps.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {isPending ? (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
                          1
                        </div>
                        <div>
                          <p className="font-medium">{t("pages.driver.pending.nextSteps.pending.step1.title")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("pages.driver.pending.nextSteps.pending.step1.description")}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                          2
                        </div>
                        <div>
                          <p className="font-medium">{t("pages.driver.pending.nextSteps.pending.step2.title")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("pages.driver.pending.nextSteps.pending.step2.description")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                          3
                        </div>
                        <div>
                          <p className="font-medium">{t("pages.driver.pending.nextSteps.pending.step3.title")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("pages.driver.pending.nextSteps.pending.step3.description")}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          1
                        </div>
                        <div>
                          <p className="font-medium">{t("pages.driver.pending.nextSteps.approved.step1.title")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("pages.driver.pending.nextSteps.approved.step1.description")}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          2
                        </div>
                        <div>
                          <p className="font-medium">{t("pages.driver.pending.nextSteps.approved.step2.title")}</p>
                          <p className="text-sm text-muted-foreground">
                            {t("pages.driver.pending.nextSteps.approved.step2.description")}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Important Information Card */}
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
                {isRejected ? t("pages.driver.pending.important.titleRejected") : t("pages.driver.pending.important.titlePending")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isRejected ? (
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
              ) : (
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
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            {isRejected ? (
              <>
                <Button
                  onClick={() => router.push('/become-driver')}
                  className="flex-1"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t("pages.driver.pending.actions.applyAgain")}
                </Button>
                <Button
                  onClick={() => router.push('/contact')}
                  variant="outline"
                  className="flex-1"
                >
                  {t("pages.driver.pending.actions.contactSupport")}
                </Button>
              </>
            ) : isApproved ? (
              <>
                <Button
                  onClick={() => router.push('/driver/dashboard')}
                  className="flex-1"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t("pages.driver.pending.actions.accessDashboard")}
                </Button>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  {t("pages.driver.pending.actions.goHome")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  {t("pages.driver.pending.actions.goHome")}
                </Button>
                <Button
                  onClick={() => router.push('/contact')}
                  className="flex-1"
                >
                  {t("pages.driver.pending.actions.contactSupport")}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
