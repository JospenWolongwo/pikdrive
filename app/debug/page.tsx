"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

export default function DebugPage() {
  const [cookieInfo, setCookieInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkCookies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/debug/cookies');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCookieInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCookieInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkCookies();
  }, []);

  return (
    <div className="container p-4 space-y-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Cookie Debug</CardTitle>
          <CardDescription>
            Check cookie status and environment configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={checkCookies} disabled={loading} className="w-full">
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {cookieInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Cookies</p>
                  <p className="text-2xl font-bold">{cookieInfo.totalCookies}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Auth Cookies</p>
                  <p className="text-2xl font-bold">{cookieInfo.authCookies?.length || 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {cookieInfo.environmentMatch ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <p className="text-sm font-medium">
                    Environment Match: {cookieInfo.environmentMatch ? 'Yes' : 'No'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {cookieInfo.sessionValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <p className="text-sm font-medium">
                    Session Valid: {cookieInfo.sessionValid ? 'Yes' : 'No'}
                  </p>
                </div>

                {cookieInfo.tokenIssuerMismatch !== undefined && (
                  <div className="flex items-center gap-2">
                    {!cookieInfo.tokenIssuerMismatch ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <p className="text-sm font-medium">
                      Token Project Match: {!cookieInfo.tokenIssuerMismatch ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}

                {cookieInfo.currentProjectRef && (
                  <div className="p-2 bg-muted rounded text-xs">
                    <p className="text-muted-foreground">Current Project: <span className="font-mono">{cookieInfo.currentProjectRef}</span></p>
                    {cookieInfo.tokenProjectRef && (
                      <p className="text-muted-foreground mt-1">Token Project: <span className="font-mono">{cookieInfo.tokenProjectRef}</span></p>
                    )}
                  </div>
                )}

                {cookieInfo.sessionError && (
                  <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
                    <p className="text-xs text-red-900 dark:text-red-100">
                      Session Error: {cookieInfo.sessionError}
                    </p>
                  </div>
                )}

                {cookieInfo.needsClearing && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      ⚠️ {cookieInfo.tokenIssuerMismatch 
                        ? 'Token from wrong project detected! Cookies should be cleared automatically.'
                        : 'Invalid session detected! Cookies should be cleared automatically.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Current Supabase URL</p>
                  <p className="text-xs font-mono break-all">{cookieInfo.currentSupabaseUrl}</p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Stored Supabase URL</p>
                  <p className="text-xs font-mono break-all">
                    {cookieInfo.storedSupabaseUrl || 'Not set'}
                  </p>
                </div>
              </div>

              {cookieInfo.authCookies && cookieInfo.authCookies.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Auth Cookies:</p>
                  <div className="space-y-2">
                    {cookieInfo.authCookies.map((cookie: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <p className="text-sm font-mono">{cookie.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {cookie.hasValue ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-gray-400" />
                          )}
                          <p className="text-xs text-muted-foreground">
                            {cookie.hasValue 
                              ? `Has value (${cookie.valueLength} chars)` 
                              : 'Empty'}
                          </p>
                        </div>
                        {cookie.valuePreview && (
                          <p className="text-xs font-mono text-muted-foreground mt-1">
                            {cookie.valuePreview}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  💡 If environment doesn't match, cookies should be cleared automatically.
                  If they persist, there may be an issue with the clearing mechanism.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

