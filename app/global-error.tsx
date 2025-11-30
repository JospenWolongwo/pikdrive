'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary Component
 * Catches errors that escape component boundaries (layout-level errors)
 * This is the last line of defense for uncaught errors
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log error details for debugging
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      timestamp: new Date().toISOString(),
      type: 'global-error',
    };

    console.error('🚨 Global Application Error (Layout Level):', errorInfo);
    console.error('Error details:', error);

    // In production, you could send this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Application Error
              </h1>
              <p className="text-muted-foreground">
                A critical error occurred. Please refresh the page or return to the home page.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left">
                <p className="text-sm font-semibold text-destructive mb-2">
                  Error Details (Development Only):
                </p>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {error.message}
                </p>
                {error.digest && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={reset}
                variant="default"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Page
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

