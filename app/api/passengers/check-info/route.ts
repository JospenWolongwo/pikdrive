import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createApiSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Verify user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', details: sessionError?.message },
        { status: 401 }
      );
    }

    // Users can only check their own passenger info
    if (session.user.id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Cannot check other user\'s info' },
        { status: 403 }
      );
    }

    // Parallel queries using Promise.all for optimization
    const [passengerDocsResult, profileResult] = await Promise.all([
      supabase
        .from("passenger_documents")
        .select("full_name, national_id_file_recto, national_id_file_verso")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (passengerDocsResult.error) {
      console.error('Error fetching passenger documents:', passengerDocsResult.error);
    }

    if (profileResult.error) {
      console.error('Error fetching profile:', profileResult.error);
    }

    const passengerDocs = passengerDocsResult.data;
    const profile = profileResult.data;

    let isComplete = false;
    let profileName = "";

    if (passengerDocs) {
      // Check if all required fields are present
      // FIX: Convert to boolean (&& returns last truthy value, not boolean)
      // This ensures isComplete is always a boolean, not a URL string
      isComplete = !!(
        passengerDocs.full_name &&
        passengerDocs.national_id_file_recto &&
        passengerDocs.national_id_file_verso
      );
      // Pre-fill with passenger doc name, fallback to profile name
      profileName = passengerDocs.full_name || profile?.full_name || "";
    } else {
      // No passenger documents - use profile name to pre-fill
      isComplete = false;
      profileName = profile?.full_name || "";
    }

    return NextResponse.json({
      success: true,
      data: { isComplete, profileName },
    });
  } catch (error) {
    console.error('Error checking passenger info:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to check passenger info' 
      },
      { status: 500 }
    );
  }
}

