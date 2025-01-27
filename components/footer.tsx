import Link from "next/link"
import { Car, Facebook, Instagram, Twitter } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 lg:gap-16">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Car className="h-8 w-8 text-primary" />
              <span className="font-bold text-2xl">WakaYamo</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your trusted ride companion for safe and affordable intercity transportation in Cameroon.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/rides" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Find Rides
                </Link>
              </li>
              <li>
                <Link href="/drivers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Our Drivers
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Connect With Us</h3>
            <div className="flex space-x-4">
              <Link href="https://facebook.com" className="text-muted-foreground hover:text-foreground transition-colors">
                <Facebook className="h-6 w-6" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link href="https://twitter.com" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-6 w-6" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link href="https://instagram.com" className="text-muted-foreground hover:text-foreground transition-colors">
                <Instagram className="h-6 w-6" />
                <span className="sr-only">Instagram</span>
              </Link>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Contact Support:</p>
              <p className="text-sm font-medium">+237 677 123 456</p>
              <p className="text-sm font-medium">support@wakayamo.com</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} WakaYamo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}