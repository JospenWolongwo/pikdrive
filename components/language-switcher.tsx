'use client'

import { useLocale } from "@/hooks";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui'
import { Globe } from 'lucide-react'
import { localeNames, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function LanguageSwitcher({ 
  className,
  variant = 'ghost',
  size = 'icon',
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLocale()

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn('rounded-full', className)}
          aria-label={t('language.switchLanguage')}
        >
          <Globe className="h-4 w-4" />
          <span className="sr-only">{t('language.switchLanguage')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleLocaleChange('fr')}
          className={locale === 'fr' ? 'bg-accent' : ''}
        >
          {localeNames.fr}
          {locale === 'fr' && ' ✓'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLocaleChange('en')}
          className={locale === 'en' ? 'bg-accent' : ''}
        >
          {localeNames.en}
          {locale === 'en' && ' ✓'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


