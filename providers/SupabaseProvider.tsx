"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ssrSupabaseConfig } from "../lib/supabase-config";

const SupabaseContext = createContext<any>(null);

export const SupabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [supabase] = useState(() =>
    createBrowserClient(
      ssrSupabaseConfig.supabaseUrl,
      ssrSupabaseConfig.supabaseKey,
      {
        auth: ssrSupabaseConfig.auth,
        cookies: ssrSupabaseConfig.cookies,
      }
    )
  );

  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);

  const initializeAuth = useCallback(async () => {
    if (initializedRef.current) return;

    try {
      initializedRef.current = true;
      const {
        data: { session: initialSession },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;

      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Clear any pending session checks
      if (sessionCheckRef.current) {
        clearTimeout(sessionCheckRef.current);
        sessionCheckRef.current = null;
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Set loading to false if we haven't already
      if (loading) {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (sessionCheckRef.current) {
        clearTimeout(sessionCheckRef.current);
      }
    };
  }, [supabase, initializeAuth, loading]);

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
