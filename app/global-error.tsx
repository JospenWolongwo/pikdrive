'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Copy, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Enhanced error logging for mobile debugging
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      timestamp: new Date().toISOString(),
      type: 'global-error',
      // Mobile-specific debug info
      screen: typeof window !== 'undefined' ? {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio
      } : 'unknown',
      navigator: typeof navigator !== 'undefined' ? {
        platform: navigator.platform,
        vendor: navigator.vendor,
        languages: navigator.languages,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        hardwareConcurrency: navigator.hardwareConcurrency
      } : 'unknown',
      // Check for common mobile issues
      localStorage: typeof window !== 'undefined' ? (() => {
        try {
          return !!window.localStorage;
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : 'Unknown'}`;
        }
      })() : 'unknown',
      indexedDB: typeof window !== 'undefined' ? (() => {
        try {
          return !!window.indexedDB;
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : 'Unknown'}`;
        }
      })() : 'unknown',
      serviceWorker: typeof navigator !== 'undefined' ? (() => {
        try {
          return !!navigator.serviceWorker;
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : 'Unknown'}`;
        }
      })() : 'unknown'
    };

    console.error('🚨 Global Application Error (Layout Level):', errorInfo);
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);

    // In production, you could send this to an error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }, [error]);

  const copyErrorDetails = async () => {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      timestamp: new Date().toISOString(),
      screen: typeof window !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 'unknown'
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Silently fail - copy operation failed
    }
  };

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
          <div className="w-full max-w-2xl space-y-6 text-center">
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
                A critical error occurred. This error has been logged for debugging.
              </p>
            </div>

            {/* Enhanced debug information for mobile */}
            <div className="rounded-lg border border-muted p-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">
                  Debug Information
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showDetails ? 'Hide' : 'Show'} Details
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Error:</strong> {error.message}</p>
                {error.digest && <p><strong>Error ID:</strong> {error.digest}</p>}
                <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
                <p><strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'unknown'}</p>
                {typeof navigator !== 'undefined' && (
                  <>
                    <p><strong>User Agent:</strong> {navigator.userAgent.substring(0, 100)}...</p>
                    <p><strong>Platform:</strong> {navigator.platform}</p>
                    <p><strong>Screen:</strong> {screen.width}x{screen.height} ({window.devicePixelRatio}x)</p>
                    <p><strong>Online:</strong> {navigator.onLine ? 'Yes' : 'No'}</p>
                  </>
                )}
              </div>

              {showDetails && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyErrorDetails}
                      className="text-xs"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      {copied ? 'Copied!' : 'Copy Debug Info'}
                    </Button>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold mb-2">Full Error Details</summary>
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                      {JSON.stringify({
                        message: error.message,
                        stack: error.stack,
                        digest: error.digest,
                        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
                        timestamp: new Date().toISOString(),
                        screen: typeof window !== 'undefined' ? `${screen.width}x${screen.height}` : 'unknown',
                        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 'unknown',
                        isIOS: typeof navigator !== 'undefined' ? /iPad|iPhone|iPod/.test(navigator.userAgent) : false,
                        isAndroid: typeof navigator !== 'undefined' ? /Android/.test(navigator.userAgent) : false,
                        touchSupport: typeof window !== 'undefined' ? 'ontouchstart' in window : false
                      }, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>

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
              Please copy the debug information above and share it with the development team.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

