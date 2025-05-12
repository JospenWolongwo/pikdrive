'use client'

import { motion } from 'framer-motion'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, AlertTriangle, HelpCircle, PhoneCall, Mail, Clock, MapPin, CreditCard, CheckCircle, Smartphone, AlertCircle, WifiOff, Truck, Network } from 'lucide-react'
import { BsWhatsapp } from 'react-icons/bs'

export default function AdvicePage() {
  const safetyTips = [
    {
      title: "Vérifiez l'Identité du Chauffeur",
      content: "Vérifiez toujours que la photo de profil du chauffeur et les détails du véhicule correspondent à ce que vous voyez en personne. Demandez à voir sa carte d&apos;identification PikDrive.",
      icon: Shield,
    },
    {
      title: "Partagez Votre Trajet",
      content: "Utilisez notre fonction &apos;Partager le Trajet&apos; pour permettre à vos amis ou à votre famille de suivre votre voyage en temps réel. Cette fonctionnalité fonctionne même en zone de faible connexion.",
      icon: AlertTriangle,
    },
    {
      title: "Restez dans les Lieux Publics",
      content: "Pour les prises en charge et les déposes, tenez-vous-en à des endroits publics bien éclairés dans la mesure du possible. Évitez les points de ramassage isolés, surtout la nuit.",
      icon: Shield,
    },
    {
      title: "Gardez Votre Code Confidentiel",
      content: "Ne partagez jamais votre code de vérification avant d'être dans le véhicule et prêt à partir. Le code est la garantie que vous recevrez le service réservé.",
      icon: AlertCircle,
    },
  ]

  const faqs = [
    {
      question: "Comment fonctionne PikDrive exactement ?",
      answer: "PikDrive est une plateforme de covoiturage intercités au Cameroun qui fonctionne en 4 étapes simples : 1) Vous choisissez votre destination et un chauffeur vérifié. 2) Vous payez pour réserver votre place via Mobile Money, carte bancaire ou en espèces chez nos partenaires. 3) Vous recevez un code de vérification unique après paiement. 4) Vous montrez ce code au chauffeur au moment du départ, ce qui valide le trajet et libère le paiement au chauffeur."
    },
    {
      question: "Comment réserver un trajet ?",
      answer: "Rendez-vous sur la page 'Trouver un Trajet', sélectionnez votre ville de départ et votre destination. Choisissez parmi les chauffeurs disponibles en fonction des horaires et prix qui vous conviennent. Procédez au paiement via notre plateforme sécurisée et vous recevrez un code de confirmation et les détails du trajet par SMS et dans l'application."
    },
    {
      question: "Comment fonctionne le système de code de vérification ?",
      answer: "Après avoir effectué votre paiement, vous recevez un code unique de 6 chiffres par SMS et dans l'application. Ce code doit être présenté au chauffeur uniquement lorsque vous êtes prêt à commencer votre voyage. Le chauffeur saisit ce code dans son application, ce qui confirme votre présence et autorise le déblocage du paiement. Sans ce code, le chauffeur ne reçoit pas son paiement."
    },
    {
      question: "Que se passe-t-il si je perds ma connexion internet ?",
      answer: "PikDrive fonctionne même en cas de connexion internet limitée. Votre code de vérification est envoyé par SMS et peut être présenté hors ligne. Les chauffeurs peuvent également valider les codes en mode hors ligne, et la synchronisation se fera automatiquement dès que la connexion est rétablie."
    },
    {
      question: "Que se passe-t-il si mon chauffeur annule ?",
      answer: "Si votre chauffeur annule, vous serez notifié immédiatement par SMS et notification dans l'application. Vous pouvez alors soit choisir un autre chauffeur disponible (nous vous proposerons des alternatives), soit demander un remboursement intégral qui sera traité sous 24 heures vers votre moyen de paiement d'origine."
    },
    {
      question: "Comment devenir chauffeur ?",
      answer: "Visitez notre page 'Devenir Chauffeur' pour commencer le processus. Vous devrez fournir : une pièce d'identité valide, votre permis de conduire, les documents du véhicule (carte grise, assurance, contrôle technique), et une photo professionnelle. Nos équipes vérifient ces documents et organisent une formation rapide sur l'utilisation de l'application. Le processus prend généralement 48-72 heures."
    },
    {
      question: "Mon paiement est-il sécurisé ?",
      answer: "Oui, nous utilisons un cryptage aux normes internationales pour toutes les transactions. Les paiements sont sécurisés par notre système de code de vérification : l'argent n'est libéré au chauffeur qu'après validation de votre code, garantissant que vous recevez bien le service réservé. En cas de problème, notre équipe d'assistance est disponible 24/7."
    },
  ]

  return (
    <main className="min-h-screen py-20">
      {/* Comment ça marche Section */}
      <section className="container mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Comment Ça Marche</h1>
          <p className="text-muted-foreground text-lg">Découvrez comment utiliser PikDrive en quelques étapes simples</p>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {[
            {
              icon: <MapPin className="w-12 h-12" />,
              title: "1. Choisissez Votre Destination",
              description: "Sélectionnez votre ville de départ, destination et date. Parcourez les options disponibles et choisissez un chauffeur qui vous convient."
            },
            {
              icon: <CreditCard className="w-12 h-12" />,
              title: "2. Effectuez le Paiement",
              description: "Réservez votre place en payant via Mobile Money, carte bancaire ou en espèces chez nos partenaires. Le paiement est temporairement bloqué."
            },
            {
              icon: <Smartphone className="w-12 h-12" />,
              title: "3. Recevez Votre Code",
              description: "Après paiement, vous recevez un code de vérification unique par SMS et dans l'application. Gardez-le précieusement."
            },
            {
              icon: <CheckCircle className="w-12 h-12" />,
              title: "4. Validez le Trajet",
              description: "Présentez votre code au chauffeur lors de votre embarquement. Ce code débloque le paiement et confirme votre trajet."
            }
          ].map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 h-full">
                <div className="mb-4 flex justify-center">
                  <div className="text-primary">{step.icon}</div>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-center">{step.title}</h3>
                <p className="text-muted-foreground text-center">{step.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="bg-primary/10 rounded-lg p-6 mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">Pourquoi utiliser le système de code ?</h2>
          <p className="text-center max-w-3xl mx-auto mb-6">
            Notre système de code unique assure que vous ne payez que pour les services que vous recevez réellement.
            Le chauffeur ne reçoit le paiement qu&apos;après que vous ayez validé votre présence dans le véhicule en présentant le code.
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="bg-background rounded p-4 text-center">
              <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Paiement Sécurisé</h3>
              <p className="text-sm text-muted-foreground">Votre argent est protégé jusqu&apos;à ce que vous confirmiez le service</p>
            </div>
            <div className="bg-background rounded p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Anti-Fraude</h3>
              <p className="text-sm text-muted-foreground">Prévient les réservations factices et garantit la présence des voyageurs</p>
            </div>
            <div className="bg-background rounded p-4 text-center">
              <Network className="w-6 h-6 text-primary mx-auto mb-2" />
              <h3 className="font-medium mb-1">Fonctionne Hors-ligne</h3>
              <p className="text-sm text-muted-foreground">Le code fonctionne même sans connexion internet permanente</p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Conseils de Sécurité</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {safetyTips.map((tip, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6">
                <div className="mb-4">
                  <tip.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{tip.title}</h3>
                <p className="text-muted-foreground">{tip.content}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problèmes Fréquents au Cameroun */}
      <section className="container mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Problèmes Fréquents</h2>
          <p className="text-muted-foreground text-lg">Solutions aux défis courants rencontrés lors des voyages intercités</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: <WifiOff className="w-8 h-8" />,
              title: "Problèmes de Connexion",
              content: "PikDrive fonctionne même dans les zones de faible connexion. Les codes de vérification sont envoyés par SMS et l'application synchronise les données lorsque la connexion est rétablie."
            },
            {
              icon: <Truck className="w-8 h-8" />,
              title: "Routes en Mauvais État",
              content: "Nos chauffeurs connaissent les routes alternatives et sont prêts à faire face aux conditions routières difficiles. Les temps de trajet estimés tiennent compte de ces facteurs."
            },
            {
              icon: <AlertCircle className="w-8 h-8" />,
              title: "Changeants Points de Contrôle",
              content: "Nos chauffeurs sont informés en temps réel des points de contrôle sur les routes. Les documents des véhicules et des chauffeurs sont toujours en règle pour éviter les retards."
            },
            {
              icon: <Clock className="w-8 h-8" />,
              title: "Retards et Annulations",
              content: "En cas de retard important, vous recevrez une notification. Si un trajet est annulé, vous pouvez facilement choisir une alternative ou obtenir un remboursement complet."
            },
            {
              icon: <CreditCard className="w-8 h-8" />,
              title: "Difficultés de Paiement",
              content: "Nous proposons des options de paiement mobile adaptées au contexte local : Mobile Money (MTN et Orange)."
            }
          ].map((issue, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 h-full">
                <div className="flex items-center mb-4">
                  <div className="p-2 rounded-full bg-primary/10 mr-3">
                    <div className="text-primary">{issue.icon}</div>
                  </div>
                  <h3 className="text-lg font-semibold">{issue.title}</h3>
                </div>
                <p className="text-muted-foreground">{issue.content}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Questions Fréquemment Posées</h2>
          <p className="text-muted-foreground text-lg">Trouvez des réponses aux questions courantes sur l&apos;utilisation de PikDrive</p>
        </motion.div>

        <Accordion type="single" collapsible className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Contact Section */}
      <section className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold mb-4">Besoin d&apos;Aide ?</h2>
          <p className="text-muted-foreground text-lg">Notre équipe d&apos;assistance est toujours prête à vous aider.</p>
        </motion.div>

        <div className="space-y-8">
          <h2 className="text-2xl font-semibold text-center">Besoin d&apos;Aide ?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mx-auto max-w-6xl px-4">
            <Card className="p-6 text-center">
              <PhoneCall className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Appelez-Nous</h3>
              <a 
                href="tel:+237698805890" 
                className="text-muted-foreground break-words hover:text-primary transition-colors"
              >
                +237 698805890
              </a>
            </Card>
            
            <Card className="p-6 text-center">
              <BsWhatsapp className="w-8 h-8 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">WhatsApp</h3>
              <a 
                href="https://wa.me/+237698805890" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground break-words hover:text-green-500 transition-colors"
              >
                +237 698805890
              </a>
            </Card>

            <Card className="p-6 text-center">
              <Mail className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Email</h3>
              <a 
                href="mailto:support@pikdrive.com"
                className="text-muted-foreground break-words hover:text-primary transition-colors"
              >
                support@pikdrive.com
              </a>
            </Card>

            <Card className="p-6 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Heures d&apos;Ouverture</h3>
              <p className="text-muted-foreground">24/7</p>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
