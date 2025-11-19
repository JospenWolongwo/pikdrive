/**
 * Server-side Supabase client utility for API routes
 * Provides a DRY way to create authenticated Supabase clients
 */
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
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
          const isProd = process.env.NODE_ENV === 'production';
          const merged = {
            name,
            value,
            path: '/',
            httpOnly: true,
            sameSite: 'lax' as const,
            secure: isProd,
            ...options,
          };
          cookieStore.set(merged);
        },
        remove(name: string, options: any) {
          const isProd = process.env.NODE_ENV === 'production';
          const merged = {
            name,
            value: "",
            path: '/',
            httpOnly: true,
            sameSite: 'lax' as const,
            secure: isProd,
            ...options,
          };
          cookieStore.set(merged);
        },
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "auth-storage",
      },
      global: {
        fetch: async (url, options = {}) => {
          // Add retry logic for network failures
          const maxRetries = 3;
          let lastError: Error | null = null;
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const response = await fetch(url, {
                ...options,
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(10000), // 10 second timeout
              });
              return response;
            } catch (error) {
              lastError = error as Error;
              console.warn(`Supabase fetch attempt ${attempt}/${maxRetries} failed:`, error);
              
              // Only retry on network errors, not auth errors
              if (attempt < maxRetries && (
                error instanceof TypeError && error.message.includes('fetch failed') ||
                error instanceof Error && error.message.includes('ECONNRESET')
              )) {
                // Exponential backoff: wait 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              
              // Don't retry on other errors or if we've exhausted retries
              break;
            }
          }
          
          // If all retries failed, throw the last error
          throw lastError || new Error('Supabase fetch failed after all retries');
        },
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

/**
 * Helper to get the authenticated user with limited retry on network errors.
 * Returns a tuple { user, errorType } where errorType can be 'network' | 'unauthorized' | 'other'.
 */
export async function getUserWithRetry(
  supabase: SupabaseClient,
  maxRetries: number = 2,
  backoffMs: number = 250
): Promise<{ user: any | null; errorType?: 'network' | 'unauthorized' | 'other'; error?: any }>{
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('fetch failed') || msg.includes('ECONNRESET')) {
          lastError = error;
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, backoffMs * attempt));
            continue;
          }
          return { user: null, errorType: 'network', error };
        }
        return { user: null, errorType: 'unauthorized', error };
      }
      if (!user) {
        return { user: null, errorType: 'unauthorized' };
      }
      return { user };
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      if (msg.includes('fetch failed') || msg.includes('ECONNRESET')) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, backoffMs * attempt));
          continue;
        }
        return { user: null, errorType: 'network', error: err };
      }
      return { user: null, errorType: 'other', error: err };
    }
  }
  return { user: null, errorType: 'other', error: lastError };
}

/**
 * Creates a server-side Supabase client with service role key
 * Use this for admin operations that need to bypass RLS
 * IMPORTANT: Only use in server-side API routes, never expose to client
 */
export function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials for service role client');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
