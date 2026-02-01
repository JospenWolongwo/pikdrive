'use client';

import { LegalLayout } from '@/components/legal/legal-layout';
import { useLocale } from '@/hooks';

export default function PrivacyPage() {
  const { locale } = useLocale();

  const sections = locale === 'fr' ? [
    { id: 'introduction', title: '1. Introduction' },
    { id: 'information-collected', title: '2. Informations Collectées' },
    { id: 'how-we-use', title: '3. Utilisation des Informations' },
    { id: 'sharing', title: '4. Partage des Données' },
    { id: 'your-rights', title: '5. Vos Droits' },
    { id: 'security', title: '6. Sécurité des Données' },
    { id: 'cookies', title: '7. Cookies et Suivi' },
    { id: 'children', title: '8. Confidentialité des Mineurs' },
    { id: 'transfers', title: '9. Transferts Internationaux' },
    { id: 'changes', title: '10. Modifications de la Politique' },
  ] : [
    { id: 'introduction', title: '1. Introduction' },
    { id: 'information-collected', title: '2. Information We Collect' },
    { id: 'how-we-use', title: '3. How We Use Your Information' },
    { id: 'sharing', title: '4. Data Sharing' },
    { id: 'your-rights', title: '5. Your Rights' },
    { id: 'security', title: '6. Data Security' },
    { id: 'cookies', title: '7. Cookies and Tracking' },
    { id: 'children', title: '8. Children\'s Privacy' },
    { id: 'transfers', title: '9. International Transfers' },
    { id: 'changes', title: '10. Changes to This Policy' },
  ];

  return (
    <LegalLayout
      title={locale === 'fr' ? 'Politique de Confidentialité' : 'Privacy Policy'}
      lastUpdated="30 janvier 2026"
      version="1.0"
      sections={sections}
    >
      {locale === 'fr' ? <FrenchContent /> : <EnglishContent />}
    </LegalLayout>
  );
}

function FrenchContent() {
  return (
    <>
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          PikDrive ("nous", "notre", "nos") exploite une plateforme numérique de mise en relation
          entre conducteurs et passagers pour des trajets interurbains au Cameroun. Nous nous
          engageons à protéger votre vie privée et vos données personnelles.
        </p>
        <p>
          Cette Politique de Confidentialité explique quelles informations nous collectons, comment
          nous les utilisons, avec qui nous les partageons, et quels sont vos droits.
        </p>
        <p>
          <strong>En utilisant PikDrive, vous acceptez cette politique.</strong>
        </p>
      </section>

      <section id="information-collected">
        <h2>2. Informations Collectées</h2>
        <h3>2.1 Informations de Compte</h3>
        <ul>
          <li>Numéro de téléphone (pour l'authentification)</li>
          <li>Nom complet</li>
          <li>Photo de profil (optionnelle)</li>
        </ul>

        <h3>2.2 Informations de Vérification d'Identité</h3>
        <p>Pour les passagers (première réservation) :</p>
        <ul>
          <li>Photos de la carte d'identité (recto/verso)</li>
          <li>Nom complet tel qu'indiqué sur la carte</li>
        </ul>
        <p>Pour les conducteurs :</p>
        <ul>
          <li>Permis de conduire</li>
          <li>Carte d'identité</li>
          <li>Assurance du véhicule</li>
          <li>Carte grise du véhicule</li>
          <li>Photos du véhicule</li>
        </ul>

        <h3>2.3 Informations de Trajet</h3>
        <ul>
          <li>Lieux de départ et d'arrivée</li>
          <li>Points de ramassage sélectionnés</li>
          <li>Dates et heures de trajet</li>
          <li>Nombre de sièges réservés</li>
        </ul>

        <h3>2.4 Informations de Paiement</h3>
        <ul>
          <li>Numéro de téléphone mobile (pour Mobile Money)</li>
          <li>Fournisseur de paiement (MTN MoMo, Orange Money, pawaPay)</li>
          <li>Historique des transactions</li>
        </ul>
        <p>
          <strong>Note :</strong> Nous ne stockons jamais les codes PIN ou mots de passe de
          paiement. Les transactions sont traitées par nos partenaires de paiement sécurisés.
        </p>

        <h3>2.5 Communications</h3>
        <ul>
          <li>Messages échangés entre conducteurs et passagers</li>
          <li>Notifications envoyées (via WhatsApp et notifications push)</li>
        </ul>

        <h3>2.6 Informations Techniques</h3>
        <ul>
          <li>Adresse IP</li>
          <li>Type de navigateur et appareil</li>
          <li>Données de cookies</li>
          <li>Logs d'utilisation de la plateforme</li>
        </ul>
      </section>

      <section id="how-we-use">
        <h2>3. Utilisation des Informations</h2>
        <p>Nous utilisons vos données pour :</p>
        <ul>
          <li>
            <strong>Mettre en relation</strong> conducteurs et passagers
          </li>
          <li>
            <strong>Traiter les paiements</strong> via notre système de séquestre sécurisé
          </li>
          <li>
            <strong>Vérifier l'identité</strong> des utilisateurs (sécurité)
          </li>
          <li>
            <strong>Envoyer des notifications</strong> importantes (réservations, messages,
            paiements)
          </li>
          <li>
            <strong>Améliorer nos services</strong> et expérience utilisateur
          </li>
          <li>
            <strong>Prévenir la fraude</strong> et assurer la sécurité
          </li>
          <li>
            <strong>Respecter nos obligations légales</strong>
          </li>
        </ul>
      </section>

      <section id="sharing">
        <h2>4. Partage des Données</h2>
        <h3>4.1 Avec les Autres Utilisateurs</h3>
        <p>Nous partageons de manière limitée :</p>
        <ul>
          <li>Nom et photo de profil (visible par les autres utilisateurs)</li>
          <li>
            Note et commentaires (après un trajet, si le système d'évaluation est activé)
          </li>
        </ul>
        <p>
          <strong>Nous ne partageons jamais :</strong> votre numéro de téléphone complet, adresse,
          documents d'identité, ou informations de paiement avec d'autres utilisateurs.
        </p>

        <h3>4.2 Avec nos Partenaires de Services</h3>
        <ul>
          <li>
            <strong>Processeurs de paiement :</strong> MTN Mobile Money, Orange Money, pawaPay
            (pour traiter les transactions)
          </li>
          <li>
            <strong>Supabase :</strong> hébergement de la base de données (États-Unis)
          </li>
          <li>
            <strong>OneSignal :</strong> notifications push
          </li>
          <li>
            <strong>WhatsApp Business API :</strong> notifications WhatsApp (si vous activez cette
            option)
          </li>
        </ul>

        <h3>4.3 Avec les Autorités</h3>
        <p>
          Nous pouvons partager vos données si requis par la loi camerounaise ou pour protéger nos
          droits, la sécurité des utilisateurs, ou enquêter sur une fraude.
        </p>
      </section>

      <section id="your-rights">
        <h2>5. Vos Droits</h2>
        <p>Vous avez le droit de :</p>
        <ul>
          <li>
            <strong>Accéder</strong> à vos données personnelles
          </li>
          <li>
            <strong>Corriger</strong> des informations inexactes
          </li>
          <li>
            <strong>Supprimer</strong> votre compte et vos données
          </li>
          <li>
            <strong>Vous opposer</strong> au traitement de vos données
          </li>
          <li>
            <strong>Retirer votre consentement</strong> (par exemple, désactiver les notifications)
          </li>
          <li>
            <strong>Porter plainte</strong> auprès d'une autorité de protection des données
          </li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à :{' '}
          <a href="mailto:support@pikdrive.com">support@pikdrive.com</a>
        </p>
      </section>

      <section id="security">
        <h2>6. Sécurité des Données</h2>
        <p>Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles :</p>
        <ul>
          <li>Chiffrement HTTPS pour toutes les communications</li>
          <li>Chiffrement des données sensibles dans la base de données</li>
          <li>Contrôles d'accès stricts (seul le personnel autorisé)</li>
          <li>Audits de sécurité réguliers</li>
          <li>Système de paiement sécurisé avec authentification à deux facteurs (mot de passe)</li>
        </ul>
        <p>
          <strong>Aucun système n'est 100% sécurisé.</strong> En cas de violation de données, nous
          vous informerons conformément à la loi.
        </p>
      </section>

      <section id="cookies">
        <h2>7. Cookies et Suivi</h2>
        <p>Nous utilisons des cookies pour :</p>
        <ul>
          <li>Maintenir votre session connectée</li>
          <li>Mémoriser vos préférences (langue, thème)</li>
          <li>Analyser l'utilisation de la plateforme</li>
        </ul>
        <p>
          Vous pouvez désactiver les cookies dans les paramètres de votre navigateur, mais certaines
          fonctionnalités pourraient ne plus fonctionner.
        </p>
      </section>

      <section id="children">
        <h2>8. Confidentialité des Mineurs</h2>
        <p>
          PikDrive est réservé aux personnes de <strong>18 ans et plus</strong>. Nous ne collectons
          pas sciemment de données d'enfants de moins de 18 ans.
        </p>
        <p>
          Si vous pensez qu'un mineur a créé un compte, contactez-nous immédiatement pour que nous
          le supprimions.
        </p>
      </section>

      <section id="transfers">
        <h2>9. Transferts Internationaux</h2>
        <p>
          Vos données sont stockées sur des serveurs Supabase situés aux <strong>États-Unis</strong>.
          En utilisant PikDrive, vous consentez à ce transfert.
        </p>
        <p>
          Supabase applique des mesures de sécurité conformes aux standards internationaux pour
          protéger vos données.
        </p>
      </section>

      <section id="changes">
        <h2>10. Modifications de la Politique</h2>
        <p>
          Nous pouvons mettre à jour cette politique de temps en temps. Les changements importants
          vous seront notifiés par email ou via une notification dans l'application.
        </p>
        <p>
          <strong>Date de dernière mise à jour :</strong> 30 janvier 2026
        </p>
        <p>
          <strong>Version :</strong> 1.0
        </p>
      </section>
    </>
  );
}

function EnglishContent() {
  return (
    <>
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          PikDrive ("we", "our", "us") operates a digital platform connecting drivers and passengers
          for intercity travel in Cameroon. We are committed to protecting your privacy and personal
          data.
        </p>
        <p>
          This Privacy Policy explains what information we collect, how we use it, who we share it
          with, and what your rights are.
        </p>
        <p>
          <strong>By using PikDrive, you accept this policy.</strong>
        </p>
      </section>

      <section id="information-collected">
        <h2>2. Information We Collect</h2>
        <h3>2.1 Account Information</h3>
        <ul>
          <li>Phone number (for authentication)</li>
          <li>Full name</li>
          <li>Profile photo (optional)</li>
        </ul>

        <h3>2.2 Identity Verification Information</h3>
        <p>For passengers (first booking):</p>
        <ul>
          <li>ID card photos (front/back)</li>
          <li>Full name as shown on ID</li>
        </ul>
        <p>For drivers:</p>
        <ul>
          <li>Driver's license</li>
          <li>ID card</li>
          <li>Vehicle insurance</li>
          <li>Vehicle registration</li>
          <li>Vehicle photos</li>
        </ul>

        <h3>2.3 Trip Information</h3>
        <ul>
          <li>Departure and arrival locations</li>
          <li>Selected pickup points</li>
          <li>Trip dates and times</li>
          <li>Number of seats booked</li>
        </ul>

        <h3>2.4 Payment Information</h3>
        <ul>
          <li>Mobile phone number (for Mobile Money)</li>
          <li>Payment provider (MTN MoMo, Orange Money, pawaPay)</li>
          <li>Transaction history</li>
        </ul>
        <p>
          <strong>Note:</strong> We never store payment PINs or passwords. Transactions are processed
          by our secure payment partners.
        </p>

        <h3>2.5 Communications</h3>
        <ul>
          <li>Messages exchanged between drivers and passengers</li>
          <li>Notifications sent (via WhatsApp and push notifications)</li>
        </ul>

        <h3>2.6 Technical Information</h3>
        <ul>
          <li>IP address</li>
          <li>Browser type and device</li>
          <li>Cookie data</li>
          <li>Platform usage logs</li>
        </ul>
      </section>

      <section id="how-we-use">
        <h2>3. How We Use Your Information</h2>
        <p>We use your data to:</p>
        <ul>
          <li>
            <strong>Connect</strong> drivers and passengers
          </li>
          <li>
            <strong>Process payments</strong> via our secure escrow system
          </li>
          <li>
            <strong>Verify identity</strong> of users (security)
          </li>
          <li>
            <strong>Send notifications</strong> about bookings, messages, and payments
          </li>
          <li>
            <strong>Improve our services</strong> and user experience
          </li>
          <li>
            <strong>Prevent fraud</strong> and ensure security
          </li>
          <li>
            <strong>Comply with legal obligations</strong>
          </li>
        </ul>
      </section>

      <section id="sharing">
        <h2>4. Data Sharing</h2>
        <h3>4.1 With Other Users</h3>
        <p>We share limited information:</p>
        <ul>
          <li>Name and profile photo (visible to other users)</li>
          <li>Ratings and reviews (after a trip, if rating system is enabled)</li>
        </ul>
        <p>
          <strong>We never share:</strong> your full phone number, address, ID documents, or payment
          information with other users.
        </p>

        <h3>4.2 With Our Service Partners</h3>
        <ul>
          <li>
            <strong>Payment processors:</strong> MTN Mobile Money, Orange Money, pawaPay (to process
            transactions)
          </li>
          <li>
            <strong>Supabase:</strong> database hosting (United States)
          </li>
          <li>
            <strong>OneSignal:</strong> push notifications
          </li>
          <li>
            <strong>WhatsApp Business API:</strong> WhatsApp notifications (if you enable this
            option)
          </li>
        </ul>

        <h3>4.3 With Authorities</h3>
        <p>
          We may share your data if required by Cameroonian law or to protect our rights, user
          safety, or investigate fraud.
        </p>
      </section>

      <section id="your-rights">
        <h2>5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>
            <strong>Access</strong> your personal data
          </li>
          <li>
            <strong>Correct</strong> inaccurate information
          </li>
          <li>
            <strong>Delete</strong> your account and data
          </li>
          <li>
            <strong>Object</strong> to data processing
          </li>
          <li>
            <strong>Withdraw consent</strong> (e.g., disable notifications)
          </li>
          <li>
            <strong>File a complaint</strong> with a data protection authority
          </li>
        </ul>
        <p>
          To exercise these rights, contact us at:{' '}
          <a href="mailto:support@pikdrive.com">support@pikdrive.com</a>
        </p>
      </section>

      <section id="security">
        <h2>6. Data Security</h2>
        <p>We implement technical and organizational security measures:</p>
        <ul>
          <li>HTTPS encryption for all communications</li>
          <li>Encryption of sensitive data in the database</li>
          <li>Strict access controls (authorized personnel only)</li>
          <li>Regular security audits</li>
          <li>Secure payment system with two-factor authentication (password)</li>
        </ul>
        <p>
          <strong>No system is 100% secure.</strong> In case of a data breach, we will inform you as
          required by law.
        </p>
      </section>

      <section id="cookies">
        <h2>7. Cookies and Tracking</h2>
        <p>We use cookies to:</p>
        <ul>
          <li>Maintain your logged-in session</li>
          <li>Remember your preferences (language, theme)</li>
          <li>Analyze platform usage</li>
        </ul>
        <p>
          You can disable cookies in your browser settings, but some features may not work properly.
        </p>
      </section>

      <section id="children">
        <h2>8. Children's Privacy</h2>
        <p>
          PikDrive is for people <strong>18 years and older</strong>. We do not knowingly collect
          data from children under 18.
        </p>
        <p>
          If you believe a minor has created an account, contact us immediately so we can delete it.
        </p>
      </section>

      <section id="transfers">
        <h2>9. International Transfers</h2>
        <p>
          Your data is stored on Supabase servers located in the <strong>United States</strong>. By
          using PikDrive, you consent to this transfer.
        </p>
        <p>
          Supabase applies security measures compliant with international standards to protect your
          data.
        </p>
      </section>

      <section id="changes">
        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Significant changes will be notified to you
          via email or an in-app notification.
        </p>
        <p>
          <strong>Last updated:</strong> January 30, 2026
        </p>
        <p>
          <strong>Version:</strong> 1.0
        </p>
      </section>
    </>
  );
}
