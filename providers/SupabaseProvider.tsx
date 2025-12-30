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

  // Clear client-side storage when switching Supabase environments
  // (Server-side handles cookie clearing in middleware)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const storedSupabaseUrl = localStorage.getItem('last-supabase-url');

    // If we switched environments, clear storage and reload
    if (storedSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
      return;
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
