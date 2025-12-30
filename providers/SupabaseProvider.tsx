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
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        // Silently handle refresh errors - background operation
      } catch (error) {
        // Silently handle refresh errors - background operation
      }
    }, 5 * 60 * 1000); // 5 minutes
  }, [supabase]);

  // Clear stale cookies when switching Supabase environments
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storedSupabaseUrl = localStorage.getItem('last-supabase-url');

    // If we switched environments, clear auth cookies
    if (storedSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl) {
      // Clear all auth-related cookies
      document.cookie.split(';').forEach((c) => {
        const cookieName = c.trim().split('=')[0];
        if (
          cookieName.includes('auth') ||
          cookieName.includes('supabase') ||
          cookieName.includes('sb-')
        ) {
          const domain = window.location.hostname;
          // Clear with domain
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${domain}`;
          // Clear without domain (for localhost)
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
          // Clear with .domain (for subdomains)
          if (domain.includes('.')) {
            const rootDomain = domain.split('.').slice(-2).join('.');
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=.${rootDomain}`;
          }
        }
      });
      
      // Clear Supabase session storage
      try {
        const storageKey = `sb-${currentSupabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`;
        Object.keys(localStorage).forEach((key) => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // Store current environment
    if (currentSupabaseUrl) {
      localStorage.setItem('last-supabase-url', currentSupabaseUrl);
    }
  }, []);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear background refresh
        if (backgroundRefreshRef.current) {
          clearInterval(backgroundRefreshRef.current);
          backgroundRefreshRef.current = null;
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Start background refresh for signed-in users
        startBackgroundRefresh();
      }
      
      setSession(session);
      setUser(session?.user || null);

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
