'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error Boundary Component
 * Catches and displays React errors gracefully
 * Shows user-friendly error message instead of generic "Application error"
 */
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error details for debugging
    // Include device/browser information for mobile debugging
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      timestamp: new Date().toISOString(),
    };

    console.error('🚨 Application Error:', errorInfo);
    console.error('Error details:', error);

    // In production, you could send this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We encountered an unexpected error. Please try again or return to the home page.
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
            Try Again
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
          If this problem persists, please contact support with the error details above.
        </p>
      </div>
    </div>
  );
}

