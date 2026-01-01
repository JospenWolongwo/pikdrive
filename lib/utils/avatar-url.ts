import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Converts an avatar URL (filename or full URL) to a full Supabase Storage URL
 * @param supabase - Supabase client instance
 * @param avatarUrl - Avatar URL (can be a filename or full URL)
 * @returns Full Supabase Storage URL or undefined if no avatar URL provided
 */
export function getAvatarUrl(
  supabase: SupabaseClient,
  avatarUrl: string | undefined | null
): string | undefined {
  if (!avatarUrl) return undefined;
  
  // If it's already a full URL, return it
  if (avatarUrl.startsWith('http')) {
    return avatarUrl;
  }
  
  // Otherwise, build the Supabase Storage URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(avatarUrl);
  
  return publicUrl;
}

