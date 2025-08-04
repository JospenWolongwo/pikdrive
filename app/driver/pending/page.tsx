'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'

export default function DriverPendingPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/auth?redirect=/driver/pending')
    }
  }, [user, router])

  if (!user) {
    return null
  }

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
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary/10 to-accent/20 rounded-full flex items-center justify-center">
              <Clock className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-primary-foreground animate-spin" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-4">Candidature en Cours d'Examen</h1>
          <p className="text-muted-foreground text-lg">
            Votre candidature pour devenir conducteur PikDrive est actuellement en cours d'examen.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-6"
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Statut de votre candidature
              </CardTitle>
              <CardDescription>
                Notre équipe examine vos documents et vérifie vos informations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                <span className="font-medium">En cours d'examen</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Temps d'examen typique : 24-48 heures
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Prochaines étapes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
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
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-5 h-5" />
                Important
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700">
                • Assurez-vous que tous vos documents sont clairs et lisibles
              </p>
              <p className="text-sm text-amber-700">
                • Vérifiez que votre adresse email est correcte pour recevoir les notifications
              </p>
              <p className="text-sm text-amber-700">
                • En cas de problème, contactez notre support
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
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
          </div>
        </motion.div>
      </div>
    </div>
  )
}
