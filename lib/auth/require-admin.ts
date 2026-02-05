import type { SupabaseClient } from "@supabase/supabase-js";

export type RequireAdminResult =
  | { session: { user: { id: string }; access_token: string } }
  | { error: string; status: 401 | 403 };

/**
 * Server-only: verify session and admin role.
 * Use in API routes that require admin access.
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<RequireAdminResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (!session?.user || sessionError) {
    return { error: "Unauthorized", status: 401 };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  if (profileError || profile?.role !== "admin") {
    return { error: "Forbidden: Admin access required", status: 403 };
  }
  return { session };
}
