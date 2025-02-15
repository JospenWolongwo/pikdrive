import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/app/providers'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { SupabaseProvider } from '@/providers/SupabaseProvider'
import { ChatProvider } from '@/providers/ChatProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PikDrive - Intercity Ride-Sharing Platform',
  description: 'Connect with trusted drivers for safe and affordable intercity travel in Cameroon.',
  icons: {
    icon: [
      {
        url: '/brand/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.ico',
      },
    ],
    apple: '/apple-touch-icon.png',
  },
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
              </div>
            </Providers>
          </ChatProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}