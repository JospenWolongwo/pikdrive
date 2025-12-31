import { NextRequest, NextResponse } from "next/server";
import { createApiSupabaseClient } from "@/lib/supabase/server-client";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    // Debug: Log cookie names (not values for security)
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    const cookieNames = allCookies.map(c => c.name);
    const authCookies = allCookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('supabase') || 
      c.name.includes('sb-')
    );
    
    console.log('[UNREAD] ===== AUTH DEBUG START =====');
    console.log('[UNREAD] Request userId:', userId);
    console.log('[UNREAD] Total cookies:', allCookies.length);
    console.log('[UNREAD] Cookie names:', cookieNames);
    console.log('[UNREAD] Auth-related cookies:', authCookies.map(c => ({
      name: c.name,
      hasValue: !!c.value,
      valueLength: c.value?.length || 0
    })));

    // Create a Supabase client using cookie-based authentication
    const supabaseClient = createApiSupabaseClient();

    // Get session first to check authentication state
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    // Verify user authentication
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    console.log('[UNREAD] Auth check result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      userPhone: user?.phone,
      hasSession: !!session,
      sessionAccessToken: session?.access_token ? 'present' : 'missing',
      sessionRefreshToken: session?.refresh_token ? 'present' : 'missing',
      sessionExpiresAt: session?.expires_at || null,
      sessionError: sessionError ? {
        message: sessionError.message,
        status: sessionError.status,
        name: sessionError.name
      } : null,
      userError: userError ? {
        message: userError.message,
        status: userError.status,
        name: userError.name
      } : null
    });

    if (!user || userError) {
      console.log('[UNREAD] ❌ UNAUTHORIZED - User check failed');
      console.log('[UNREAD] ===== AUTH DEBUG END =====');
      return NextResponse.json(
        { success: false, error: "Unauthorized", details: userError?.message },
        { status: 401 }
      );
    }

    // Verify the user is requesting their own unread counts
    if (user.id !== userId) {
      console.log('[UNREAD] ❌ FORBIDDEN - User ID mismatch:', {
        authenticatedUserId: user.id,
        requestedUserId: userId
      });
      console.log('[UNREAD] ===== AUTH DEBUG END =====');
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    console.log('[UNREAD] ✅ User authenticated, fetching unread messages...');

    // Fetch unread messages count by conversation
    const { data, error } = await supabaseClient
      .from("messages")
      .select("conversation_id, sender_id, read")
      .neq("sender_id", userId)
      .eq("read", false);

    if (error) {
      console.error('[UNREAD] ❌ Error fetching unread messages:', error);
      console.log('[UNREAD] ===== AUTH DEBUG END =====');
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('[UNREAD] Messages fetched:', {
      count: data?.length || 0,
      messages: data?.slice(0, 3) // Log first 3 for debugging
    });

    // Count messages by conversation_id
    const unreadCounts = (data || []).reduce(
      (acc: Record<string, number>, msg: { conversation_id: string }) => {
        acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Convert to array format
    const result = Object.entries(unreadCounts).map(([conversationId, count]) => ({
      conversationId: conversationId,
      count,
    }));

    console.log('[UNREAD] ✅ Success - Unread counts:', result);
    console.log('[UNREAD] ===== AUTH DEBUG END =====');

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[UNREAD] ❌ EXCEPTION in GET /api/messages/unread/[userId]:', error);
    console.log('[UNREAD] ===== AUTH DEBUG END =====');
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

