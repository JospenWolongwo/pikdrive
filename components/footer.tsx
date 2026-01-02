'use client'

import Link from 'next/link'
import { Car, Facebook, Instagram, X } from 'lucide-react'
import { useLocale } from "@/hooks";

export function Footer() {
  const currentYear = new Date().getFullYear()
  const { t } = useLocale()

  return (
    <footer className="w-full border-t bg-background">
      <div className="container pt-10 pb-4">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Link href="/" className="flex items-center space-x-2">
              <Car className="h-6 w-6" />
              <span className="font-bold">PikDrive</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">{t("navigation.quickLinks")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/rides" className="text-muted-foreground hover:text-primary">
                  {t("navigation.findRide")}
                </Link>
              </li>
              <li>
                <Link href="/become-driver" className="text-muted-foreground hover:text-primary">
                  {t("navigation.becomeDriver")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary">
                  {t("navigation.aboutUs")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-primary">
                  {t("navigation.contact")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">{t("navigation.legal")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary">
                  {t("navigation.privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary">
                  {t("navigation.termsOfUse")}
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-muted-foreground hover:text-primary">
                  {t("navigation.cookiePolicy")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">{t("navigation.followUs")}</h3>
            <div className="flex space-x-4">
              <Link
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">X</span>
              </Link>
              <Link
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary"
              >
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-8">
          <p className="text-center text-sm text-muted-foreground">
            {t("footer.copyright", { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  )
}