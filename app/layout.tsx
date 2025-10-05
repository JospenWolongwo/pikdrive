import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SupabaseProvider } from "@/providers/SupabaseProvider";
import { RouteOptimizer } from "@/components/performance/route-optimizer";
import PWAPrompts from "@/components/pwa/PWAPrompts";
import { Analytics } from "@vercel/analytics/react";
import { OneSignalInitializer } from "@/components/notifications/OneSignalInitializer";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#28C496",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PikDrive - Your Trusted Intercity Ride-Sharing Platform",
  description:
    "Connect with trusted drivers for safe and affordable intercity travel in Cameroon.",
  applicationName: "PikDrive",
  appleWebApp: {
    capable: true,
    title: "PikDrive",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
      { url: "/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/apple-icon-120x120.png", sizes: "120x120", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PikDrive" />
        <meta name="theme-color" content="#28C496" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        {/* OneSignal SDK - Professional Push Notifications */}
        <script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          defer
        />
      </head>
      <body className={`h-full ${inter.className}`}>
        <SupabaseProvider>
          <Providers>
            <OneSignalInitializer />
            <RouteOptimizer>
              <div className="relative flex min-h-screen flex-col">
                <PWAPrompts />
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
                <Analytics />
              </div>
            </RouteOptimizer>
          </Providers>
        </SupabaseProvider>
      </body>
    </html>
  );
}
