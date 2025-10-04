/**
 * Server-side Supabase client utility for API routes
 * Provides a DRY way to create authenticated Supabase clients
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a server-side Supabase client for API routes
 * Handles cookie management and authentication configuration
 */
export function createApiSupabaseClient(): SupabaseClient {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "auth-storage",
      },
    }
  );
}

/**
 * Creates a server-side Supabase client and ensures user is authenticated
 * Returns the client and user, or throws an error if not authenticated
 */
export async function createAuthenticatedSupabaseClient(): Promise<{
  supabase: SupabaseClient;
  user: any;
}> {
  const supabase = createApiSupabaseClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  
  return { supabase, user };
}
