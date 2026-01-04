"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { supabaseClient } from "../lib/supabase-client";

const SupabaseContext = createContext<any>(null);

export const SupabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [supabase] = useState(() => supabaseClient);

  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const backgroundRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const startBackgroundRefresh = useCallback(() => {
    // Clear any existing interval
    if (backgroundRefreshRef.current) {
      clearInterval(backgroundRefreshRef.current);
    }

    // Refresh session every 5 minutes to keep tokens warm
    backgroundRefreshRef.current = setInterval(async () => {
      // Only refresh if we have a user - don't refresh if already logged out
      if (!user) {
        return;
      }

      try {
        console.log('🔄 Background session refresh...');
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) {
          // Log error but don't clear state - let onAuthStateChange handle it
          console.warn('⚠️ Background refresh failed:', error.message);
          // Silent failure - error will NOT clear user state (onAuthStateChange handler preserves state)
        } else if (session) {
          // Session refreshed successfully - cookies are automatically updated by Supabase
          console.log('✅ Background refresh successful');
        }
      } catch (error) {
        // Silent failure - error will NOT clear user state (onAuthStateChange handler preserves state)
        console.warn('⚠️ Background refresh error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }, [supabase, user]); // Add user to dependencies

  // Validate and clear cookies ONLY when switching environments
  // Don't run on every page load - only when environment actually changes
  // Uses cookie to match server-side logic (cookie is set by middleware/server)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!currentSupabaseUrl) return; // Exit if env var not available
    
    // Use cookie instead of localStorage to match server-side logic
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
      return null;
    };
    
    const storedSupabaseUrl = getCookie('supabase-project-url');

    // CRITICAL FIX: Normalize URLs before comparison to avoid false positives
    const normalizeUrl = (url: string | null): string | null => {
      if (!url) return null;
      // Remove trailing slashes and normalize
      return url.trim().replace(/\/+$/, '').toLowerCase();
    };

    const normalizedStored = normalizeUrl(storedSupabaseUrl);
    const normalizedCurrent = normalizeUrl(currentSupabaseUrl);

    // Only validate if environment changed (not on every load)
    // CRITICAL: Don't trigger if cookie doesn't exist yet (middleware will set it)
    const environmentChanged = normalizedStored && normalizedStored !== normalizedCurrent;
    
    if (!environmentChanged) {
      // No environment change - just exit (cookie is set by middleware/server)
      return;
    }

    // Environment changed - validate and clear
    const validateAndClear = async () => {
      try {
        // CRITICAL: Double-check with server before clearing
        const response = await fetch('/api/auth/clear-cookies', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ timestamp: Date.now() }),
        });
        
        if (!response.ok) {
          // If API fails, don't clear - might be a network issue
          console.warn('Failed to validate environment change with server');
          return;
        }
        
        const data = await response.json();
        
        // CRITICAL: Only clear if server confirms it's necessary
        // Don't clear on transient failures
        if (data.cleared) {
          // Sign out client-side as well
          await supabase.auth.signOut();
          
          // Client-side cookie clearing as backup
          document.cookie.split(";").forEach((c) => {
            const cookieName = c.replace(/^ +/, "").replace(/=.*/, "");
            if (
              cookieName.includes('auth') ||
              cookieName.includes('supabase') ||
              cookieName.includes('sb-')
            ) {
              const isSecure = window.location.protocol === 'https:';
              document.cookie = `${cookieName}=; expires=${new Date().toUTCString()}; path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;
            }
          });
          
          // Clear storage
          localStorage.clear();
          sessionStorage.clear();
          
          // Reload
          setTimeout(() => {
            window.location.reload();
          }, 100);
          return;
        }
      } catch (error) {
        // CRITICAL: Don't reload on error - let user continue
        // Network errors shouldn't cause logouts
        console.warn('Error validating environment change:', error);
      }
    };

    validateAndClear();
  }, []); // CRITICAL FIX: Empty dependency array - only run once on mount

  const initializeAuth = useCallback(async () => {
    if (initializedRef.current) return;

    try {
      initializedRef.current = true;
      const {
        data: { session: initialSession },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        setLoading(false);
        return;
      }

      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
        // Start background refresh for signed-in users
        startBackgroundRefresh();
      } else {
        // CRITICAL FIX: No session found - try to refresh (handles expired access tokens)
        // This restores sessions when app resumes after being in background
        console.log('🔄 No session found on init - attempting refresh...');
        try {
          const { data: { session: refreshedSession }, error: refreshError } = 
            await supabase.auth.refreshSession();
          
          if (!refreshError && refreshedSession?.user) {
            console.log('✅ Session restored via refresh on app start');
            setSession(refreshedSession);
            setUser(refreshedSession.user);
            startBackgroundRefresh();
          } else if (refreshError) {
            // Only clear if refresh definitively fails with auth error
            if (refreshError.message?.includes('refresh_token_not_found') || 
                refreshError.message?.includes('invalid_grant')) {
              console.log('❌ Refresh token invalid - user needs to re-login');
              setSession(null);
              setUser(null);
            }
            // Otherwise preserve state (might be network issue)
          }
        } catch (refreshErr) {
          // Silent fail - network or other transient error
        }
      }
    } catch (error) {
      // Silently fail - session loading error
    } finally {
      setLoading(false);
    }
  }, [supabase, startBackgroundRefresh]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔐 Auth state change: ${event}`, session ? `session exists (user: ${session.user?.id})` : 'no session');

      if (event === 'SIGNED_OUT') {
        // CRITICAL FIX: Verify this is a real logout, not a transient error
        // Supabase can emit SIGNED_OUT on network errors or token refresh failures
        // We should attempt to restore the session before clearing state
        
        // Check if we have a user state that suggests this might be a false logout
        if (user) {
          console.log('⚠️ SIGNED_OUT event received but user state exists - attempting to restore session...');
          
          // Give a brief moment for any in-flight operations to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to get the current session
          try {
            const { data: { session: currentSession }, error: sessionError } = 
              await supabase.auth.getSession();
            
            if (!sessionError && currentSession?.user) {
              // Session still exists - this was a false logout event
              console.log('✅ Session restored - false logout prevented');
              setSession(currentSession);
              setUser(currentSession.user);
              startBackgroundRefresh();
              return; // Don't clear state
            }
            
            // If getSession failed, try refresh as a last resort
            if (sessionError || !currentSession) {
              console.log('🔄 getSession failed, trying refresh...');
              const { data: { session: refreshedSession }, error: refreshError } = 
                await supabase.auth.refreshSession();
              
              if (!refreshError && refreshedSession?.user) {
                // Session refreshed successfully - false logout prevented
                console.log('✅ Session refreshed - false logout prevented');
                setSession(refreshedSession);
                setUser(refreshedSession.user);
                startBackgroundRefresh();
                return; // Don't clear state
              }
              
              // Only clear if refresh definitively fails with auth errors
              if (refreshError && (
                refreshError.message?.includes('refresh_token_not_found') ||
                refreshError.message?.includes('invalid_grant') ||
                refreshError.message?.includes('JWT expired')
              )) {
                console.log('❌ Refresh token invalid - confirming logout');
                // This is a real logout - clear state
              } else {
                // Network or other transient error - preserve state
                console.log('⚠️ Transient error during logout verification - preserving state');
                return; // Don't clear state
              }
            }
          } catch (error) {
            // Error during verification - preserve state to be safe
            console.warn('⚠️ Error verifying logout - preserving state:', error);
            return; // Don't clear state
          }
        }
        
        // Only clear state if we've confirmed this is a real logout
        console.log('🔐 Confirmed logout - clearing state');
        setSession(null);
        setUser(null);
        
        // Clear background refresh
        if (backgroundRefreshRef.current) {
          clearInterval(backgroundRefreshRef.current);
          backgroundRefreshRef.current = null;
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        // User signed in - update state
        setSession(session);
        setUser(session.user);
        // Start background refresh for signed-in users
        startBackgroundRefresh();
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // Token refreshed successfully - update state
          setSession(session);
          setUser(session.user);
        }
        // If session is null, preserve existing state (prevents false logouts)
      } else if (session?.user) {
        // Any other event with a valid session - update state
        setSession(session);
        setUser(session.user);
      }
      // If event has null session (but not SIGNED_OUT), preserve existing state
      // This prevents false logouts from transient errors

      // Set loading to false if we haven't already
      if (loading) {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      // Clear background refresh on unmount
      if (backgroundRefreshRef.current) {
        clearInterval(backgroundRefreshRef.current);
        backgroundRefreshRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, initializeAuth]);

  // CRITICAL FIX: Restore session when app comes back to foreground (PWA resume)
  // This handles cases where background refresh stopped while app was suspended
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = async () => {
      // Only check if app became visible (not when it goes to background)
      if (document.hidden) return;

      // CRITICAL FIX: Add delay for PWA resume - service worker needs time to sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Only restore if we have user state but lost session (indicates expired access token)
      if (user && !session) {
        console.log('🔄 PWA resumed - attempting to restore session...');
        try {
          // CRITICAL FIX: Try getSession first (faster, uses cookies)
          const { data: { session: restoredSession }, error } = await supabase.auth.getSession();
          
          if (!error && restoredSession?.user) {
            console.log('✅ Session restored on PWA resume');
            setSession(restoredSession);
            setUser(restoredSession.user);
            startBackgroundRefresh();
            return;
          }

          // If getSession failed, try refresh as fallback
          if (error || !restoredSession) {
            console.log('🔄 getSession failed, trying refresh...');
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            
            if (!refreshError && refreshedSession?.user) {
              console.log('✅ Session refreshed on PWA resume');
              setSession(refreshedSession);
              setUser(refreshedSession.user);
              startBackgroundRefresh();
            } else if (refreshError) {
              // Only clear if refresh definitively fails
              if (refreshError.message?.includes('refresh_token_not_found') || 
                  refreshError.message?.includes('invalid_grant')) {
                console.log('❌ Refresh token invalid on resume - clearing session');
                setSession(null);
                setUser(null);
              }
              // Otherwise preserve state (might be network issue)
            }
          }
        } catch (error) {
          // Silent fail - don't clear state on unexpected errors
          console.warn('⚠️ Error during PWA session restoration:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, session, supabase, startBackgroundRefresh]);

  return (
    <SupabaseContext.Provider value={{ supabase, user, session, loading }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
};
