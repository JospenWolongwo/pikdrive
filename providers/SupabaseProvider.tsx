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
import { useAuthStore } from "../stores/authStore";

const SupabaseContext = createContext<any>(null);

export const SupabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [supabase] = useState(() => supabaseClient);
  const { user: zustandUser, getSession, clearUser } = useAuthStore();

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

      if (error) {
        console.error("Session error:", error);
        throw error;
      }

      if (initialSession?.user) {
        setSession(initialSession);
        setUser(initialSession.user);
      } else {
        // Check if Zustand store has user data
        if (zustandUser) {
          setUser(zustandUser);
          // Don't try to refresh session here as it might clear the user
          // The user will be used as fallback until a proper session is established
        }
      }
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, zustandUser, getSession, clearUser]);

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

      // Only clear Zustand store if we explicitly get a sign out event
      if (event === 'SIGNED_OUT' && zustandUser) {
        clearUser();
      }

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

  // Listen to Zustand user changes
  useEffect(() => {
    if (zustandUser && !user) {
      setUser(zustandUser);
    } else if (!zustandUser && user) {
      setUser(null);
      setSession(null);
    }
  }, [zustandUser, user]);

  // Manual session refresh mechanism
  useEffect(() => {
    const refreshSession = async () => {
      if (zustandUser && !session) {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error("Session refresh failed:", error.message);
          } else if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
          }
        } catch (error) {
          console.error("Session refresh error:", error);
        }
      }
    };

    // Try to refresh session after a short delay
    const timeoutId = setTimeout(refreshSession, 1000);
    return () => clearTimeout(timeoutId);
  }, [zustandUser, session, supabase]);

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
