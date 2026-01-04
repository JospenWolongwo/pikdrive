import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/app/providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SupabaseProvider } from "@/providers/SupabaseProvider";
import { RouteOptimizer } from "@/components/performance/route-optimizer";
import PWAPrompts from "@/components/pwa/PWAPrompts";
import { Analytics } from "@vercel/analytics/react";
import { OneSignalInitializer } from "@/components/notifications/OneSignalInitializer";
import { getLocaleFromCookie } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import { TranslationErrorBoundary } from "./error-boundary";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

export const viewport: Viewport = {
  themeColor: "#28C496",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale");
  const locale = getLocaleFromCookie(localeCookie?.value);
  const messages = locale === "en" ? enMessages : frMessages;

  return {
    title: messages.metadata.title,
    description: messages.metadata.description,
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
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale");
  const locale = getLocaleFromCookie(localeCookie?.value);

  return (
    <html lang={locale} className="h-full" suppressHydrationWarning>
      <head>
        <script 
          src="/api/onesignal/sdk/OneSignalSDK.page.js" 
          defer
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Track OneSignal SDK loading with defensive checks
              (function() {
                try {
                  // Defensive check: Ensure document is available
                  if (typeof document === 'undefined') {
                    return;
                  }

                  // Use IIFE to avoid polluting global scope
                  function trackOneSignalScript() {
                    try {
                      // Check if script loaded successfully
                      const script = document.querySelector('script[src="/api/onesignal/sdk/OneSignalSDK.page.js"]');
                      if (script) {
                        script.addEventListener('load', function() {
                          // Script loaded successfully
                        });
                        script.addEventListener('error', function(e) {
                          // Script failed to load - gracefully degrade
                        });
                      }
                    } catch (error) {
                      // Silently fail - gracefully degrade
                    }
                  }

                  // Wait for DOM to be ready
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', trackOneSignalScript);
                  } else {
                    // DOM is already loaded
                    trackOneSignalScript();
                  }
                } catch (error) {
                  // Silently fail - gracefully degrade
                }
              })();
            `,
          }}
        />
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
      </head>
      <body className={`h-full ${inter.className}`}>
        <TranslationErrorBoundary>
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
        </TranslationErrorBoundary>
      </body>
    </html>
  );
}
