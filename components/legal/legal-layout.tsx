'use client';

import { ReactNode } from 'react';
import { Button, Separator } from '@/components/ui';
import { useLocale } from '@/hooks';

interface Section {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  version: string;
  sections: Section[];
  children: ReactNode;
}

export function LegalLayout({
  title,
  lastUpdated,
  version,
  sections,
  children,
}: LegalLayoutProps) {
  const { t, locale, setLocale } = useLocale();

  const handleLanguageToggle = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with language toggle */}
      <div className="border-b bg-muted/30 print:hidden">
        <div className="container max-w-5xl py-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('legal.version')}: {version} • {t('legal.lastUpdated')}: {lastUpdated}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLanguageToggle}
            className="gap-2"
          >
            {locale === 'fr' ? '🇬🇧 English' : '🇫🇷 Français'}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="container max-w-5xl py-12 px-4">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
          <p className="text-muted-foreground">
            {t('legal.effectiveDate')}: {lastUpdated}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Table of Contents - Sticky on desktop */}
          <aside className="lg:col-span-1 print:hidden">
            <div className="lg:sticky lg:top-4">
              <h2 className="text-lg font-semibold mb-4">
                {t('legal.tableOfContents')}
              </h2>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="block w-full text-left text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="prose prose-gray dark:prose-invert max-w-none">
              {children}
            </div>

            <Separator className="my-8" />

            {/* Contact footer */}
            <div className="mt-8 p-6 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-3">{t('legal.contact.title')}</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>PikDrive</strong>
                </p>
                <p>{t('legal.contact.address')}: Silicon Mountain, Buea, Cameroun</p>
                <p>
                  {t('legal.contact.email')}: support@pikdrive.com, info@pikdrive.com
                </p>
                <p>{t('legal.contact.phone')}: +237 6 21 79 34 23</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          body {
            font-size: 12pt;
          }
          h1 {
            font-size: 24pt;
          }
          h2 {
            font-size: 18pt;
          }
          h3 {
            font-size: 14pt;
          }
        }
      `}</style>
    </div>
  );
}
