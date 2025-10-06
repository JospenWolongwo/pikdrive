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

interface DriverStatus {
  driver_status: string
  driver_application_status: string
  is_driver_applicant: boolean
}

export default function DriverPendingPage() {
  const { user, supabase } = useSupabase()
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
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!driverStatus?.is_driver_applicant) {
    return (
      <div className="container py-10">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Aucune candidature trouvée</h1>
          <p className="text-muted-foreground mb-6">
            Vous n'avez pas encore soumis de candidature pour devenir conducteur.
          </p>
          <Button onClick={() => router.push('/become-driver')}>
            Devenir conducteur
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
              ? 'Candidature Refusée' 
              : isApproved 
              ? 'Candidature Approuvée'
              : 'Candidature en Cours d\'Examen'
            }
          </h1>
          <p className="text-muted-foreground text-lg">
            {isRejected 
              ? 'Votre candidature pour devenir conducteur PikDrive n\'a pas été approuvée.'
              : isApproved 
              ? 'Félicitations ! Votre candidature a été approuvée.'
              : 'Votre candidature pour devenir conducteur PikDrive est actuellement en cours d\'examen.'
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
                ? 'Refusé' 
                : isApproved 
                ? 'Approuvé'
                : 'En attente'
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
                Statut de votre candidature
              </CardTitle>
              <CardDescription>
                {isRejected 
                  ? 'Votre candidature n\'a pas été approuvée pour les raisons suivantes'
                  : isApproved 
                  ? 'Votre candidature a été approuvée avec succès'
                  : 'Notre équipe examine vos documents et vérifie vos informations'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isRejected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-red-100 rounded-lg">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="font-medium text-red-800">Candidature refusée</span>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-red-200">
                    <h4 className="font-semibold text-red-800 mb-2">Raisons possibles :</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• Documents incomplets ou illisibles</li>
                      <li>• Informations personnelles incorrectes</li>
                      <li>• Documents de véhicule expirés</li>
                      <li>• Antécédents de conduite problématiques</li>
                    </ul>
                  </div>
                  <p className="text-sm text-red-700">
                    <strong>Note :</strong> Vous pouvez soumettre une nouvelle candidature après avoir corrigé les problèmes identifiés.
                  </p>
                </div>
              ) : isApproved ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-green-100 rounded-lg">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-800">Candidature approuvée</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Félicitations ! Vous pouvez maintenant commencer à publier des trajets.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                    <span className="font-medium">En cours d'examen</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Temps d'examen typique : 24-48 heures
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
                  Prochaines étapes
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
                          <p className="font-medium">Examen des documents</p>
                          <p className="text-sm text-muted-foreground">
                            Vérification de vos pièces d'identité et documents de véhicule
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                          2
                        </div>
                        <div>
                          <p className="font-medium">Notification par email</p>
                          <p className="text-sm text-muted-foreground">
                            Vous recevrez un email avec le résultat de votre candidature
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                          3
                        </div>
                        <div>
                          <p className="font-medium">Commencer à conduire</p>
                          <p className="text-sm text-muted-foreground">
                            Après approbation, vous pourrez publier des trajets
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
                          <p className="font-medium">Accéder au tableau de bord</p>
                          <p className="text-sm text-muted-foreground">
                            Utilisez le bouton ci-dessous pour accéder à votre espace conducteur
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          2
                        </div>
                        <div>
                          <p className="font-medium">Publier votre premier trajet</p>
                          <p className="text-sm text-muted-foreground">
                            Créez et gérez vos trajets depuis votre tableau de bord
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
                {isRejected ? 'Informations importantes' : 'Important'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isRejected ? (
                <>
                  <p className="text-sm text-red-700">
                    • Vérifiez que tous vos documents sont clairs et lisibles
                  </p>
                  <p className="text-sm text-red-700">
                    • Assurez-vous que vos informations personnelles sont correctes
                  </p>
                  <p className="text-sm text-red-700">
                    • Vérifiez que vos documents de véhicule sont à jour
                  </p>
                  <p className="text-sm text-red-700">
                    • En cas de question, contactez notre support
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-700">
                    • Assurez-vous que tous vos documents sont clairs et lisibles
                  </p>
                  <p className="text-sm text-amber-700">
                    • Vérifiez que votre adresse email est correcte pour recevoir les notifications
                  </p>
                  <p className="text-sm text-amber-700">
                    • En cas de problème, contactez notre support
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
                  Postuler à nouveau
                </Button>
                <Button
                  onClick={() => router.push('/contact')}
                  variant="outline"
                  className="flex-1"
                >
                  Contacter le support
                </Button>
              </>
            ) : isApproved ? (
              <>
                <Button
                  onClick={() => router.push('/driver/dashboard')}
                  className="flex-1"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Accéder au tableau de bord
                </Button>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  Retour à l'accueil
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  Retour à l'accueil
                </Button>
                <Button
                  onClick={() => router.push('/contact')}
                  className="flex-1"
                >
                  Contacter le support
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
