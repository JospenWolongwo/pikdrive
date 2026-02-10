'use client';

import { LegalLayout } from '@/components';
import { useLocale } from '@/hooks';

export default function TermsPage() {
  const { locale } = useLocale();

  const sections = locale === 'fr' ? [
    { id: 'acceptance', title: '1. Acceptation des Conditions' },
    { id: 'role', title: '2. Rôle de PikDrive' },
    { id: 'user-relationship', title: '3. Relation entre Utilisateurs' },
    { id: 'drivers', title: '4. Publication des Trajets (Conducteurs)' },
    { id: 'passengers', title: '5. Réservation et Paiement (Passagers)' },
    { id: 'password-escrow', title: '6. Système Mot de Passe + Séquestre' },
    { id: 'commission', title: '7. Commission de la Plateforme' },
    { id: 'responsibilities', title: '8. Responsabilités' },
    { id: 'suspension', title: '9. Suspension et Sécurité' },
    { id: 'applicable-law', title: '10. Droit Applicable' },
  ] : [
    { id: 'acceptance', title: '1. Acceptance of Terms' },
    { id: 'role', title: '2. PikDrive\'s Role' },
    { id: 'user-relationship', title: '3. User Relationship' },
    { id: 'drivers', title: '4. Trip Publication (Drivers)' },
    { id: 'passengers', title: '5. Booking and Payment (Passengers)' },
    { id: 'password-escrow', title: '6. Password + Escrow System' },
    { id: 'commission', title: '7. Platform Commission' },
    { id: 'responsibilities', title: '8. Responsibilities' },
    { id: 'suspension', title: '9. Suspension and Security' },
    { id: 'applicable-law', title: '10. Applicable Law' },
  ];

  return (
    <LegalLayout
      title={locale === 'fr' ? 'Conditions Générales d\'Utilisation' : 'Terms of Service'}
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
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
        <p className="font-semibold text-yellow-900 dark:text-yellow-100">
          ⚠️ Important : En utilisant l'application PikDrive, vous acceptez sans réserve les
          conditions ci-dessous.
        </p>
      </div>

      <section id="acceptance">
        <h2>1. Acceptation des Conditions</h2>
        <p>
          En cliquant sur "J'accepte", en créant un compte, ou en utilisant PikDrive, vous
          reconnaissez avoir lu, compris et accepté l'intégralité de ces Conditions Générales
          d'Utilisation.
        </p>
        <p>
          Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser la plateforme PikDrive.
        </p>
      </section>

      <section id="role">
        <h2>2. Rôle de PikDrive</h2>
        <p>PikDrive est une plateforme numérique de mise en relation entre :</p>
        <ul>
          <li>des conducteurs proposant des trajets interurbains</li>
          <li>et des passagers souhaitant réserver une place sur ces trajets.</li>
        </ul>
        <p className="font-semibold bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
          PikDrive n'est <strong>PAS</strong> un transporteur, ne fournit <strong>AUCUN</strong>{' '}
          service de transport et ne possède <strong>AUCUN</strong> véhicule.
        </p>
        <p>
          Le transport est réalisé exclusivement sous la responsabilité du conducteur. PikDrive
          facilite uniquement la mise en relation et la gestion des paiements.
        </p>
      </section>

      <section id="user-relationship">
        <h2>3. Relation entre Utilisateurs</h2>
        <p>
          Le trajet constitue un <strong>accord direct entre le conducteur et le passager</strong>.
        </p>
        <p>PikDrive n'est pas intégré au contrat de transport. Son activité se limite strictement à :</p>
        <ul>
          <li>La mise en relation du conducteur et du passager</li>
          <li>La sécurisation du paiement via le système de séquestre</li>
          <li>La facilitation des communications</li>
        </ul>
        <p>
          Les conducteurs agissent en toute indépendance, sans lien de subordination avec PikDrive qui
          n'est qu'un moyen pour les chauffeurs de donner de la visibilité à leurs trajets.
        </p>
      </section>

      <section id="drivers">
        <h2>4. Publication des Trajets (Conducteurs)</h2>
        <p>Les conducteurs :</p>
        <ul>
          <li>Publient librement leurs trajets, horaires et prix</li>
          <li>
            Déclarent être responsables de la conformité de leur activité (véhicule, assurance,
            autorisations)
          </li>
        </ul>
        <h3>4.1 Vérification des Documents</h3>
        <p>
          La plateforme PikDrive s'assure de la conformité des pièces du chauffeur{' '}
          <strong>(carte d'identité, permis de conduire, assurance et carte grise)</strong>{' '}
          uniquement lors de l'inscription.
        </p>
        <h3>4.2 Mise à Jour des Documents</h3>
        <p>
          En cas d'expiration d'un document, il revient au chauffeur de demander la mise à jour de ses
          informations sur la plateforme.
        </p>
        <p className="font-semibold bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
          ⚠️ À ce titre, le chauffeur cessera ses activités jusqu'à obtention de document(s) valables.
        </p>
        <p>PikDrive n'intervient pas dans l'exécution du trajet.</p>
      </section>

      <section id="passengers">
        <h2>5. Réservation et Paiement (Passagers)</h2>
        <h3>5.1 Processus de Réservation</h3>
        <p>Pour réserver un trajet :</p>
        <ol>
          <li>Le passager sélectionne un trajet disponible</li>
          <li>Le passager effectue un paiement sur la plateforme PikDrive</li>
          <li>
            Le montant est temporairement conservé par la plateforme à titre de{' '}
            <strong>séquestre technique</strong> (l'argent est mis en attente de manière sécurisée
            par la plateforme)
          </li>
        </ol>
        <p className="font-semibold">
          Ce paiement n'est <strong>PAS</strong> immédiatement versé au conducteur.
        </p>
        <h3>5.2 Moyens de Paiement Acceptés</h3>
        <ul>
          <li>MTN Mobile Money</li>
          <li>Orange Money</li>
          <li>pawaPay</li>
        </ul>
      </section>

      <section id="password-escrow">
        <h2>6. Système "Mot de Passe + Séquestre" (OBLIGATOIRE)</h2>
        <p className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 p-4 rounded">
          Ce système est <strong>ESSENTIEL</strong> pour la sécurité des paiements et doit être
          respecté par tous les utilisateurs.
        </p>
        <h3>6.1 Après le Paiement</h3>
        <ol>
          <li>PikDrive génère un <strong>mot de passe unique</strong></li>
          <li>Ce mot de passe est communiqué au passager (via l'application et notifications)</li>
        </ol>
        <h3>6.2 Déblocage du Paiement</h3>
        <p>Le paiement est débloqué <strong>UNIQUEMENT</strong> lorsque :</p>
        <ol>
          <li>Le passager rencontre le conducteur</li>
          <li>Le passager communique <strong>volontairement</strong> son mot de passe au conducteur</li>
          <li>Le conducteur saisit le mot de passe dans l'application</li>
        </ol>
        <p className="font-semibold">
          La saisie du mot de passe vaut confirmation de la rencontre et autorisation de libération des
          fonds.
        </p>
        <h3>6.3 Règles Importantes</h3>
        <ul>
          <li>
            Le passager <strong>NE DOIT PAS</strong> communiquer le mot de passe avant d'être dans le
            véhicule
          </li>
          <li>
            Le conducteur <strong>NE PEUT PAS</strong> recevoir le paiement sans le mot de passe
          </li>
          <li>Ce système protège les deux parties contre la fraude</li>
        </ul>
      </section>

      <section id="commission">
        <h2>7. Commission de la Plateforme</h2>
        <p>PikDrive perçoit une commission de service sur chaque réservation.</p>
        <p>Cette commission rémunère :</p>
        <ul>
          <li>La mise en relation entre conducteurs et passagers</li>
          <li>Les services numériques (application, notifications, support)</li>
          <li>La sécurisation du paiement via le système de séquestre</li>
        </ul>
        <p className="font-semibold">
          PikDrive n'est <strong>PAS</strong> rémunéré pour le transport lui-même.
        </p>
      </section>

      <section id="responsibilities">
        <h2>8. Responsabilités</h2>
        <h3>8.1 Responsabilités de PikDrive</h3>
        <p>PikDrive n'est <strong>PAS</strong> responsable :</p>
        <ul>
          <li>Du déroulement du trajet</li>
          <li>Des retards, annulations ou incidents</li>
          <li>Des accidents ou dommages</li>
          <li>Du comportement des utilisateurs</li>
          <li>De la véracité des informations fournies par les utilisateurs</li>
        </ul>
        <h3>8.2 Responsabilités du Conducteur</h3>
        <p>Le conducteur est <strong>SEUL RESPONSABLE</strong> :</p>
        <ul>
          <li>De la conduite du véhicule</li>
          <li>De la sécurité des passagers</li>
          <li>Du respect des lois et règlements applicables</li>
          <li>De la validité de son permis, assurance et documents du véhicule</li>
          <li>De l'état et de l'entretien du véhicule</li>
        </ul>
        <h3>8.3 Responsabilités du Passager</h3>
        <p>Le passager s'engage :</p>
        <ul>
          <li>
            À ne communiquer le mot de passe <strong>qu'en cas de rencontre effective</strong> avec le
            conducteur
          </li>
          <li>À respecter le conducteur et les autres passagers</li>
          <li>À fournir des informations véridiques lors de l'inscription</li>
          <li>À respecter les horaires convenus</li>
        </ul>
      </section>

      <section id="suspension">
        <h2>9. Suspension et Sécurité</h2>
        <p>PikDrive peut suspendre ou supprimer un compte en cas :</p>
        <ul>
          <li>De fraude ou tentative de fraude</li>
          <li>De non-respect des règles (notamment le système mot de passe)</li>
          <li>D'utilisation abusive de la plateforme</li>
          <li>De comportement inapproprié ou dangereux</li>
          <li>De fausses informations ou documents</li>
          <li>De non-paiement ou annulations répétées</li>
        </ul>
        <p>
          La suspension peut être temporaire ou définitive, selon la gravité de l'infraction.
        </p>
      </section>

      <section id="applicable-law">
        <h2>10. Droit Applicable</h2>
        <p>
          Les présentes conditions sont régies par le <strong>droit camerounais</strong>.
        </p>
        <p>
          Tout litige relève des juridictions compétentes du <strong>Cameroun</strong>.
        </p>
        <h3>10.1 Résolution des Litiges</h3>
        <p>
          En cas de litige entre utilisateurs, PikDrive encourage une résolution à l'amiable. Si
          nécessaire, les parties peuvent recourir aux tribunaux camerounais compétents.
        </p>
        <h3>10.2 Modifications des Conditions</h3>
        <p>
          PikDrive se réserve le droit de modifier ces conditions à tout moment. Les utilisateurs
          seront informés des changements importants et devront accepter les nouvelles conditions pour
          continuer à utiliser la plateforme.
        </p>
      </section>

      <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg mt-8">
        <h3 className="font-semibold mb-3">Résumé des Points Clés</h3>
        <ul className="space-y-2 text-sm">
          <li>✓ PikDrive est une plateforme de mise en relation (pas un transporteur)</li>
          <li>✓ Le conducteur est responsable du transport et de la sécurité</li>
          <li>✓ Le système mot de passe + séquestre est obligatoire</li>
          <li>✓ Ne partagez le mot de passe qu'après avoir rencontré le conducteur</li>
          <li>✓ Les documents des conducteurs doivent toujours être valides</li>
        </ul>
      </div>
    </>
  );
}

function EnglishContent() {
  return (
    <>
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
        <p className="font-semibold text-yellow-900 dark:text-yellow-100">
          ⚠️ Important: By using the PikDrive application, you accept these terms without reservation.
        </p>
      </div>

      <section id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By clicking "I accept", creating an account, or using PikDrive, you acknowledge that you have
          read, understood, and accepted these Terms of Service in their entirety.
        </p>
        <p>
          If you do not accept these terms, you must not use the PikDrive platform.
        </p>
      </section>

      <section id="role">
        <h2>2. PikDrive's Role</h2>
        <p>PikDrive is a digital platform connecting:</p>
        <ul>
          <li>drivers offering intercity trips</li>
          <li>and passengers wishing to book a seat on these trips.</li>
        </ul>
        <p className="font-semibold bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
          PikDrive is <strong>NOT</strong> a carrier, provides <strong>NO</strong> transportation
          service, and owns <strong>NO</strong> vehicles.
        </p>
        <p>
          Transportation is performed exclusively under the driver's responsibility. PikDrive only
          facilitates connections and manages payments.
        </p>
      </section>

      <section id="user-relationship">
        <h2>3. User Relationship</h2>
        <p>
          The trip constitutes a <strong>direct agreement between the driver and passenger</strong>.
        </p>
        <p>PikDrive is not part of the transportation contract. Its activity is strictly limited to:</p>
        <ul>
          <li>Connecting drivers and passengers</li>
          <li>Securing payment through the escrow system</li>
          <li>Facilitating communications</li>
        </ul>
        <p>
          Drivers act independently, with no subordination to PikDrive, which is only a means for
          drivers to give visibility to their trips.
        </p>
      </section>

      <section id="drivers">
        <h2>4. Trip Publication (Drivers)</h2>
        <p>Drivers:</p>
        <ul>
          <li>Freely publish their trips, schedules, and prices</li>
          <li>
            Declare themselves responsible for the compliance of their activity (vehicle, insurance,
            authorizations)
          </li>
        </ul>
        <h3>4.1 Document Verification</h3>
        <p>
          The PikDrive platform verifies driver documents{' '}
          <strong>(ID card, driver's license, insurance, and vehicle registration)</strong> only during
          registration.
        </p>
        <h3>4.2 Document Updates</h3>
        <p>
          In case of document expiration, it is the driver's responsibility to request an update of
          their information on the platform.
        </p>
        <p className="font-semibold bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
          ⚠️ As such, the driver must cease activities until valid document(s) are obtained.
        </p>
        <p>PikDrive does not intervene in trip execution.</p>
      </section>

      <section id="passengers">
        <h2>5. Booking and Payment (Passengers)</h2>
        <h3>5.1 Booking Process</h3>
        <p>To book a trip:</p>
        <ol>
          <li>The passenger selects an available trip</li>
          <li>The passenger makes a payment on the PikDrive platform</li>
          <li>
            The amount is temporarily held by the platform as a{' '}
            <strong>technical escrow</strong> (money is securely held by the platform)
          </li>
        </ol>
        <p className="font-semibold">
          This payment is <strong>NOT</strong> immediately transferred to the driver.
        </p>
        <h3>5.2 Accepted Payment Methods</h3>
        <ul>
          <li>MTN Mobile Money</li>
          <li>Orange Money</li>
          <li>pawaPay</li>
        </ul>
      </section>

      <section id="password-escrow">
        <h2>6. "Password + Escrow" System (MANDATORY)</h2>
        <p className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 p-4 rounded">
          This system is <strong>ESSENTIAL</strong> for payment security and must be respected by all
          users.
        </p>
        <h3>6.1 After Payment</h3>
        <ol>
          <li>PikDrive generates a <strong>unique password</strong></li>
          <li>This password is communicated to the passenger (via the app and notifications)</li>
        </ol>
        <h3>6.2 Payment Release</h3>
        <p>Payment is released <strong>ONLY</strong> when:</p>
        <ol>
          <li>The passenger meets the driver</li>
          <li>The passenger <strong>voluntarily</strong> communicates their password to the driver</li>
          <li>The driver enters the password in the application</li>
        </ol>
        <p className="font-semibold">
          Entering the password confirms the meeting and authorizes the release of funds.
        </p>
        <h3>6.3 Important Rules</h3>
        <ul>
          <li>
            The passenger <strong>MUST NOT</strong> communicate the password before being in the vehicle
          </li>
          <li>
            The driver <strong>CANNOT</strong> receive payment without the password
          </li>
          <li>This system protects both parties against fraud</li>
        </ul>
      </section>

      <section id="commission">
        <h2>7. Platform Commission</h2>
        <p>PikDrive collects a service commission on each booking.</p>
        <p>This commission covers:</p>
        <ul>
          <li>Connecting drivers and passengers</li>
          <li>Digital services (app, notifications, support)</li>
          <li>Payment security through the escrow system</li>
        </ul>
        <p className="font-semibold">
          PikDrive is <strong>NOT</strong> compensated for the transportation itself.
        </p>
      </section>

      <section id="responsibilities">
        <h2>8. Responsibilities</h2>
        <h3>8.1 PikDrive's Responsibilities</h3>
        <p>PikDrive is <strong>NOT</strong> responsible for:</p>
        <ul>
          <li>Trip execution</li>
          <li>Delays, cancellations, or incidents</li>
          <li>Accidents or damages</li>
          <li>User behavior</li>
          <li>The accuracy of information provided by users</li>
        </ul>
        <h3>8.2 Driver Responsibilities</h3>
        <p>The driver is <strong>SOLELY RESPONSIBLE</strong> for:</p>
        <ul>
          <li>Driving the vehicle</li>
          <li>Passenger safety</li>
          <li>Compliance with applicable laws and regulations</li>
          <li>The validity of their license, insurance, and vehicle documents</li>
          <li>The condition and maintenance of the vehicle</li>
        </ul>
        <h3>8.3 Passenger Responsibilities</h3>
        <p>The passenger commits to:</p>
        <ul>
          <li>
            Communicating the password <strong>only after actually meeting</strong> the driver
          </li>
          <li>Respecting the driver and other passengers</li>
          <li>Providing truthful information during registration</li>
          <li>Respecting agreed schedules</li>
        </ul>
      </section>

      <section id="suspension">
        <h2>9. Suspension and Security</h2>
        <p>PikDrive may suspend or delete an account in case of:</p>
        <ul>
          <li>Fraud or attempted fraud</li>
          <li>Non-compliance with rules (especially the password system)</li>
          <li>Abusive use of the platform</li>
          <li>Inappropriate or dangerous behavior</li>
          <li>False information or documents</li>
          <li>Non-payment or repeated cancellations</li>
        </ul>
        <p>
          Suspension may be temporary or permanent, depending on the severity of the violation.
        </p>
      </section>

      <section id="applicable-law">
        <h2>10. Applicable Law</h2>
        <p>
          These terms are governed by <strong>Cameroonian law</strong>.
        </p>
        <p>
          Any dispute falls under the jurisdiction of <strong>Cameroonian</strong> courts.
        </p>
        <h3>10.1 Dispute Resolution</h3>
        <p>
          In case of disputes between users, PikDrive encourages amicable resolution. If necessary,
          parties may resort to competent Cameroonian courts.
        </p>
        <h3>10.2 Terms Modifications</h3>
        <p>
          PikDrive reserves the right to modify these terms at any time. Users will be informed of
          significant changes and must accept the new terms to continue using the platform.
        </p>
      </section>

      <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg mt-8">
        <h3 className="font-semibold mb-3">Summary of Key Points</h3>
        <ul className="space-y-2 text-sm">
          <li>✓ PikDrive is a connection platform (not a carrier)</li>
          <li>✓ The driver is responsible for transportation and safety</li>
          <li>✓ The password + escrow system is mandatory</li>
          <li>✓ Only share the password after meeting the driver</li>
          <li>✓ Driver documents must always be valid</li>
        </ul>
      </div>
    </>
  );
}
