import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/app/providers'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { SupabaseProvider } from '@/providers/SupabaseProvider'
import { ChatProvider } from '@/providers/ChatProvider'
import { PWAPrompts } from '@/components/pwa/PWAPrompts'
import { Analytics } from '@vercel/analytics/react'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'PikDrive - Intercity Ride-Sharing Platform',
  description: 'Connect with trusted drivers for safe and affordable intercity travel in Cameroon.',
  applicationName: 'PikDrive',
  appleWebApp: {
    capable: true,
    title: 'PikDrive',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png'
      }
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
      { url: '/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-icon-120x120.png', sizes: '120x120', type: 'image/png' }
    ]
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className={inter.className}>
        <SupabaseProvider>
          <ChatProvider>
            <Providers>
              <div className="relative flex min-h-screen flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
                <PWAPrompts />
                <Analytics />
              </div>
            </Providers>
          </ChatProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}