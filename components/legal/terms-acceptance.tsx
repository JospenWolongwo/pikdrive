'use client';

import { useState } from 'react';
import { Checkbox, Alert, AlertDescription, AlertTitle } from '@/components/ui';
import Link from 'next/link';
import { ExternalLink, FileText } from 'lucide-react';
import { useLocale } from '@/hooks';

interface TermsAcceptanceProps {
  required?: boolean;
  onAcceptanceChange: (accepted: boolean) => void;
  variant?: 'compact' | 'detailed';
  type?: 'general' | 'driver';
}

export function TermsAcceptance({
  required = true,
  onAcceptanceChange,
  variant = 'compact',
  type = 'general',
}: TermsAcceptanceProps) {
  const [accepted, setAccepted] = useState(false);
  const { t } = useLocale();

  const handleChange = (checked: boolean) => {
    setAccepted(checked);
    onAcceptanceChange(checked);
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-start space-x-2">
        <Checkbox
          id="terms-acceptance"
          checked={accepted}
          onCheckedChange={handleChange}
          required={required}
          className="mt-1"
        />
        <label
          htmlFor="terms-acceptance"
          className="text-sm text-muted-foreground leading-tight cursor-pointer"
        >
          {t('legal.acceptance.compact')}{' '}
          <Link
            href="/terms"
            target="_blank"
            className="text-primary underline hover:text-primary/80 inline-flex items-center gap-1"
          >
            {t('legal.acceptance.termsLink')}
            <ExternalLink className="h-3 w-3" />
          </Link>
          {' '}{t('legal.acceptance.and')}{' '}
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary underline hover:text-primary/80 inline-flex items-center gap-1"
          >
            {t('legal.acceptance.privacyLink')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </label>
      </div>
    );
  }

  // Detailed variant with driver-specific or passenger-specific content
  if (type === 'driver') {
    return (
      <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
        <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertTitle>{t('legal.driver.title')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p className="text-sm">{t('legal.driver.intro')}</p>

          <div className="space-y-2 text-sm">
            <div className="flex items-start space-x-2">
              <Checkbox id="driver-responsibility" required />
              <label htmlFor="driver-responsibility" className="cursor-pointer">
                <strong>{t('legal.driver.responsibility.bold')}</strong>{' '}
                {t('legal.driver.responsibility.text')}
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="driver-insurance" required />
              <label htmlFor="driver-insurance" className="cursor-pointer">
                {t('legal.driver.insurance.text')}{' '}
                <strong>{t('legal.driver.insurance.bold')}</strong>{' '}
                {t('legal.driver.insurance.continue')}
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="driver-independence" required />
              <label htmlFor="driver-independence" className="cursor-pointer">
                {t('legal.driver.independence')}
              </label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="driver-password-system" required />
              <label htmlFor="driver-password-system" className="cursor-pointer">
                {t('legal.driver.passwordSystem.text')}{' '}
                <strong>{t('legal.driver.passwordSystem.bold')}</strong>{' '}
                {t('legal.driver.passwordSystem.continue')}
              </label>
            </div>
          </div>

          <div className="border-t pt-3 mt-3">
            <div className="flex items-start space-x-2 bg-white dark:bg-gray-900 p-3 rounded">
              <Checkbox
                id="driver-full-terms"
                checked={accepted}
                onCheckedChange={handleChange}
                required={required}
              />
              <label
                htmlFor="driver-full-terms"
                className="text-sm cursor-pointer"
              >
                {t('legal.driver.fullAcceptance')}{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-primary underline font-medium hover:text-primary/80 inline-flex items-center gap-1"
                >
                  {t('legal.acceptance.termsLink')}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {' '}{t('legal.driver.ofPikDrive')}
              </label>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Detailed variant for passengers (at booking/ID upload)
  return (
    <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertTitle>{t('legal.passenger.title')}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p className="text-sm">{t('legal.passenger.intro')}</p>
        <ul className="text-sm space-y-1 ml-4">
          <li>✓ {t('legal.passenger.verifyIdentity')}</li>
          <li>✓ {t('legal.passenger.understandPassword')}</li>
          <li>✓ {t('legal.passenger.giveCodeAfterMeet')}</li>
        </ul>

        <div className="flex items-start space-x-2 mt-3">
          <Checkbox
            id="passenger-confirmation"
            checked={accepted}
            onCheckedChange={handleChange}
            required={required}
          />
          <label htmlFor="passenger-confirmation" className="text-xs cursor-pointer">
            {t('legal.passenger.confirmUnderstanding')}
          </label>
        </div>
      </AlertDescription>
    </Alert>
  );
}
