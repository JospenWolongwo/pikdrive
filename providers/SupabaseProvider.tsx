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
import { debugLog } from "../lib/debug-logger";

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
    // Clear any existing interval or timeout
    if (backgroundRefreshRef.current) {
      try {
        clearTimeout(backgroundRefreshRef.current);
      } catch {}
      try {
        clearInterval(backgroundRefreshRef.current);
      } catch {}
      backgroundRefreshRef.current = null;
    }

    // CRITICAL FIX: Refresh before token expires, not just every 5 minutes
    // Check token expiration and refresh 5 minutes before expiry
    const scheduleRefresh = async () => {
      if (!user || !session) return;
      
      const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
      if (!expiresAt) {
        // No expiration info - use default 5 minute interval
        backgroundRefreshRef.current = setInterval(async () => {
          await performRefresh();
        }, 5 * 60 * 1000);
        return;
      }
      
      const now = Date.now();
      const expiryTime = expiresAt.getTime();
      const timeUntilExpiry = expiryTime - now;
      const refreshBeforeExpiry = 5 * 60 * 1000; // 5 minutes before expiry
      
      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:36',message:'Scheduling token refresh',data:{userId:user?.id,expiresAt:expiresAt.toISOString(),timeUntilExpiryMs:timeUntilExpiry,timeUntilExpiryMinutes:Math.round(timeUntilExpiry/60000),refreshInMs:Math.max(timeUntilExpiry - refreshBeforeExpiry, 60000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
      // #endregion
      
      // Schedule refresh 5 minutes before expiry, or immediately if less than 5 min remaining
      const refreshDelay = Math.max(timeUntilExpiry - refreshBeforeExpiry, 60000); // At least 1 minute
      
      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:61',message:'Setting refresh timeout',data:{refreshDelayMs:refreshDelay,refreshDelayMinutes:Math.round(refreshDelay/60000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
      // #endregion
      
      backgroundRefreshRef.current = setTimeout(async () => {
        await performRefresh();
        // After refresh, reschedule the next one (session state will be updated by performRefresh)
        scheduleRefresh();
      }, refreshDelay) as unknown as NodeJS.Timeout;
    };
    
    const performRefresh = async () => {
      // Only refresh if we have a user - don't refresh if already logged out
      if (!user) {
        // #region agent log
        debugLog({location:'SupabaseProvider.tsx:37',message:'Background refresh skipped - no user',data:{hasUser:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        // #endregion
        return;
      }

      try {
        console.log('🔄 Background session refresh...');
        // #region agent log
        const currentExpiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;
        const currentTimeUntilExpiry = currentExpiresAt ? currentExpiresAt.getTime() - Date.now() : null;
        debugLog({location:'SupabaseProvider.tsx:42',message:'Background refresh starting',data:{userId:user?.id,currentExpiresAt:currentExpiresAt?.toISOString(),currentTimeUntilExpiryMs:currentTimeUntilExpiry,currentTimeUntilExpiryMinutes:currentTimeUntilExpiry ? Math.round(currentTimeUntilExpiry/60000) : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        // #endregion
        const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
        if (error) {
          // Log error but don't clear state - let onAuthStateChange handle it
          console.warn('⚠️ Background refresh failed:', error.message);
          // #region agent log
          debugLog({location:'SupabaseProvider.tsx:48',message:'Background refresh failed',data:{error:error.message,errorCode:error.status,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
          // #endregion
          // Silent failure - error will NOT clear user state (onAuthStateChange handler preserves state)
        } else if (refreshedSession) {
          // Session refreshed successfully - cookies are automatically updated by Supabase
          console.log('✅ Background refresh successful');
          // #region agent log
          const expiresAt = refreshedSession.expires_at ? new Date(refreshedSession.expires_at * 1000) : null;
          const timeUntilExpiry = expiresAt ? expiresAt.getTime() - Date.now() : null;
          debugLog({location:'SupabaseProvider.tsx:54',message:'Background refresh success',data:{userId:refreshedSession.user?.id,expiresAt:expiresAt?.toISOString(),expiresAtTimestamp:refreshedSession.expires_at,timeUntilExpiryMs:timeUntilExpiry,timeUntilExpiryMinutes:timeUntilExpiry ? Math.round(timeUntilExpiry/60000) : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
          // #endregion
          // Update session state so next refresh is scheduled correctly
          setSession(refreshedSession);
        }
      } catch (error) {
        // Silent failure - error will NOT clear user state (onAuthStateChange handler preserves state)
        console.warn('⚠️ Background refresh error:', error);
        // #region agent log
        debugLog({location:'SupabaseProvider.tsx:59',message:'Background refresh exception',data:{error:error instanceof Error?error.message:String(error),userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'});
        // #endregion
      }
    };
    
    // Start the refresh scheduling
    scheduleRefresh();
  }, [supabase, user, session]); // Add user and session to dependencies

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
      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:160',message:'Initializing auth',data:{cookies:typeof document!=='undefined'?document.cookie.split(';').filter(c=>c.includes('sb-')||c.includes('supabase')).length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'});
      // #endregion
      const {
        data: { session: initialSession },
        error,
      } = await supabase.auth.getSession();
      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:167',message:'Initial getSession result',data:{hasSession:!!initialSession,sessionUserId:initialSession?.user?.id,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'});
      // #endregion

      if (error) {
        setLoading(false);
        return;
      }

      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
        // #region agent log
        const expiresAt = initialSession.expires_at ? new Date(initialSession.expires_at * 1000) : null;
        const timeUntilExpiry = expiresAt ? expiresAt.getTime() - Date.now() : null;
        debugLog({location:'SupabaseProvider.tsx:195',message:'Session initialized',data:{userId:initialSession.user.id,expiresAt:expiresAt?.toISOString(),timeUntilExpiryMs:timeUntilExpiry,timeUntilExpiryMinutes:timeUntilExpiry ? Math.round(timeUntilExpiry/60000) : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
        // #endregion
        // Start background refresh for signed-in users
        startBackgroundRefresh();
      } else {
        // CRITICAL FIX: No session found - try to refresh (handles expired access tokens)
        // This restores sessions when app resumes after being in background
        console.log('🔄 No session found on init - attempting refresh...');
        // #region agent log
        debugLog({location:'SupabaseProvider.tsx:182',message:'No session on init - attempting refresh',data:{cookies:typeof document!=='undefined'?document.cookie.split(';').filter(c=>c.includes('sb-')||c.includes('supabase')).length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'});
        // #endregion
        try {
          const { data: { session: refreshedSession }, error: refreshError } = 
            await supabase.auth.refreshSession();
          // #region agent log
          debugLog({location:'SupabaseProvider.tsx:186',message:'Init refreshSession result',data:{hasSession:!!refreshedSession,sessionUserId:refreshedSession?.user?.id,error:refreshError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'});
          // #endregion
          
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
          // #region agent log
          debugLog({location:'SupabaseProvider.tsx:202',message:'Init refreshSession exception',data:{error:refreshErr instanceof Error?refreshErr.message:String(refreshErr)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'});
          // #endregion
        }
      }
    } catch (error) {
      // Silently fail - session loading error
      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:206',message:'Init auth exception',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'});
      // #endregion
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
      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:217',message:'Auth state change event',data:{event,hasSession:!!session,sessionUserId:session?.user?.id,currentUser:!!user,currentUserId:user?.id,currentSession:!!session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
      // #endregion

      if (event === 'SIGNED_OUT') {
        // CRITICAL FIX: Verify this is a real logout, not a transient error
        // Supabase can emit SIGNED_OUT on network errors or token refresh failures
        // We should attempt to restore the session before clearing state
        // #region agent log
        debugLog({location:'SupabaseProvider.tsx:222',message:'SIGNED_OUT event received',data:{hasUser:!!user,userId:user?.id,hasSession:!!session,cookies:document.cookie.split(';').filter(c=>c.includes('sb-')||c.includes('supabase')).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
        // #endregion
        
        // Check if we have a user state that suggests this might be a false logout
        if (user) {
          console.log('⚠️ SIGNED_OUT event received but user state exists - attempting to restore session...');
          
          // Give a brief moment for any in-flight operations to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Try to get the current session
          try {
            // #region agent log
            debugLog({location:'SupabaseProvider.tsx:234',message:'Attempting getSession for verification',data:{userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
            // #endregion
            const { data: { session: currentSession }, error: sessionError } = 
              await supabase.auth.getSession();
            // #region agent log
            debugLog({location:'SupabaseProvider.tsx:237',message:'getSession result',data:{hasSession:!!currentSession,sessionUserId:currentSession?.user?.id,error:sessionError?.message,errorCode:sessionError?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
            // #endregion
            
            if (!sessionError && currentSession?.user) {
              // Session still exists - this was a false logout event
              console.log('✅ Session restored - false logout prevented');
              // #region agent log
              debugLog({location:'SupabaseProvider.tsx:240',message:'False logout prevented - session restored',data:{userId:currentSession.user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
              // #endregion
              setSession(currentSession);
              setUser(currentSession.user);
              startBackgroundRefresh();
              return; // Don't clear state
            }
            
            // If getSession failed, try refresh as a last resort
            if (sessionError || !currentSession) {
              console.log('🔄 getSession failed, trying refresh...');
              // #region agent log
              debugLog({location:'SupabaseProvider.tsx:248',message:'Attempting refreshSession for verification',data:{userId:user?.id,getSessionError:sessionError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
              // #endregion
              const { data: { session: refreshedSession }, error: refreshError } = 
                await supabase.auth.refreshSession();
              // #region agent log
              debugLog({location:'SupabaseProvider.tsx:252',message:'refreshSession result',data:{hasSession:!!refreshedSession,sessionUserId:refreshedSession?.user?.id,error:refreshError?.message,errorCode:refreshError?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
              // #endregion
              
              if (!refreshError && refreshedSession?.user) {
                // Session refreshed successfully - false logout prevented
                console.log('✅ Session refreshed - false logout prevented');
                // #region agent log
                debugLog({location:'SupabaseProvider.tsx:256',message:'False logout prevented - session refreshed',data:{userId:refreshedSession.user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
                // #endregion
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
                // #region agent log
                debugLog({location:'SupabaseProvider.tsx:266',message:'Real logout confirmed - auth error',data:{error:refreshError.message,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
                // #endregion
                // This is a real logout - clear state
              } else {
                // Network or other transient error - preserve state
                console.log('⚠️ Transient error during logout verification - preserving state');
                // #region agent log
                debugLog({location:'SupabaseProvider.tsx:270',message:'Transient error - preserving state',data:{error:refreshError?.message,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
                // #endregion
                return; // Don't clear state
              }
            }
          } catch (error) {
            // Error during verification - preserve state to be safe
            console.warn('⚠️ Error verifying logout - preserving state:', error);
            // #region agent log
            debugLog({location:'SupabaseProvider.tsx:276',message:'Exception during verification - preserving state',data:{error:error instanceof Error?error.message:String(error),userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'});
            // #endregion
            return; // Don't clear state
          }
        }
        
        // Only clear state if we've confirmed this is a real logout
        console.log('🔐 Confirmed logout - clearing state');
        // #region agent log
        debugLog({location:'SupabaseProvider.tsx:283',message:'Clearing user state - confirmed logout',data:{hadUser:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'});
        // #endregion
        setSession(null);
        setUser(null);
        
        // Clear background refresh
        if (backgroundRefreshRef.current) {
          clearTimeout(backgroundRefreshRef.current);
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
        // #region agent log
        const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;
        const timeUntilExpiry = expiresAt ? expiresAt.getTime() - Date.now() : null;
        debugLog({location:'SupabaseProvider.tsx:367',message:'TOKEN_REFRESHED event',data:{hasSession:!!session,userId:session?.user?.id,expiresAt:expiresAt?.toISOString(),expiresAtTimestamp:session?.expires_at,timeUntilExpiryMs:timeUntilExpiry,timeUntilExpiryMinutes:timeUntilExpiry ? Math.round(timeUntilExpiry/60000) : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'});
        // #endregion
        if (session?.user) {
          // Token refreshed successfully - update state
          setSession(session);
          setUser(session.user);
          // Reschedule background refresh with new expiration time
          startBackgroundRefresh();
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
        clearTimeout(backgroundRefreshRef.current);
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

      // #region agent log
      debugLog({location:'SupabaseProvider.tsx:336',message:'Visibility change - app visible',data:{hasUser:!!user,hasSession:!!session,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
      // #endregion

      // CRITICAL FIX: Add delay for PWA resume - service worker needs time to sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Only restore if we have user state but lost session (indicates expired access token)
      if (user && !session) {
        console.log('🔄 PWA resumed - attempting to restore session...');
        // #region agent log
        debugLog({location:'SupabaseProvider.tsx:345',message:'PWA resume - restoring session',data:{userId:user?.id,cookies:document.cookie.split(';').filter(c=>c.includes('sb-')||c.includes('supabase')).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
        // #endregion
        try {
          // CRITICAL FIX: Try getSession first (faster, uses cookies)
          const { data: { session: restoredSession }, error } = await supabase.auth.getSession();
          // #region agent log
          debugLog({location:'SupabaseProvider.tsx:348',message:'PWA resume getSession result',data:{hasSession:!!restoredSession,sessionUserId:restoredSession?.user?.id,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
          // #endregion
          
          if (!error && restoredSession?.user) {
            console.log('✅ Session restored on PWA resume');
            // #region agent log
            debugLog({location:'SupabaseProvider.tsx:352',message:'PWA resume - session restored',data:{userId:restoredSession.user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
            // #endregion
            setSession(restoredSession);
            setUser(restoredSession.user);
            startBackgroundRefresh();
            return;
          }

          // If getSession failed, try refresh as fallback
          if (error || !restoredSession) {
            console.log('🔄 getSession failed, trying refresh...');
            // #region agent log
            debugLog({location:'SupabaseProvider.tsx:360',message:'PWA resume - attempting refresh',data:{userId:user?.id,getSessionError:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
            // #endregion
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            // #region agent log
            debugLog({location:'SupabaseProvider.tsx:364',message:'PWA resume refreshSession result',data:{hasSession:!!refreshedSession,sessionUserId:refreshedSession?.user?.id,error:refreshError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
            // #endregion
            
            if (!refreshError && refreshedSession?.user) {
              console.log('✅ Session refreshed on PWA resume');
              // #region agent log
              debugLog({location:'SupabaseProvider.tsx:368',message:'PWA resume - session refreshed',data:{userId:refreshedSession.user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
              // #endregion
              setSession(refreshedSession);
              setUser(refreshedSession.user);
              startBackgroundRefresh();
            } else if (refreshError) {
              // Only clear if refresh definitively fails
              if (refreshError.message?.includes('refresh_token_not_found') || 
                  refreshError.message?.includes('invalid_grant')) {
                console.log('❌ Refresh token invalid on resume - clearing session');
                // #region agent log
                debugLog({location:'SupabaseProvider.tsx:375',message:'PWA resume - clearing session (auth error)',data:{error:refreshError.message,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
                // #endregion
                setSession(null);
                setUser(null);
              }
              // Otherwise preserve state (might be network issue)
            }
          }
        } catch (error) {
          // Silent fail - don't clear state on unexpected errors
          console.warn('⚠️ Error during PWA session restoration:', error);
          // #region agent log
          debugLog({location:'SupabaseProvider.tsx:382',message:'PWA resume - exception',data:{error:error instanceof Error?error.message:String(error),userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'});
          // #endregion
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
