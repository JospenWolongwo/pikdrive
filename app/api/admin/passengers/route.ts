import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase/server-client';
import type { PassengerDocument } from '@/types/passenger';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    
    // Verify user session and admin role
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

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Fetch passenger documents
    const { data: passengerDocs, error: docsError } = await supabase
      .from("passenger_documents")
      .select("*");

    if (docsError) {
      console.error('Error fetching passenger documents:', docsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch passenger documents' },
        { status: 500 }
      );
    }

    if (!passengerDocs || passengerDocs.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Fetch profiles for these users (parallel query)
    const userIds = passengerDocs.map((doc: PassengerDocument) => doc.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, city, avatar_url, created_at, updated_at")
      .in("id", userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profiles' },
        { status: 500 }
      );
    }

    // Combine passenger documents with profiles
    const passengers = passengerDocs.map((doc: PassengerDocument) => {
      const profile = profiles?.find((p: { id: string }) => p.id === doc.user_id);
      return {
        id: doc.user_id,
        full_name: doc.full_name || profile?.full_name || "Unknown Passenger",
        email: profile?.email || "No email provided",
        phone: profile?.phone || "No phone provided",
        city: profile?.city || "No location provided",
        avatar_url: profile?.avatar_url,
        created_at: profile?.created_at || doc.created_at,
        updated_at: doc.updated_at,
        documents: doc,
      };
    });

    return NextResponse.json({
      success: true,
      data: passengers,
    });
  } catch (error) {
    console.error('Error in admin passengers API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch passengers' 
      },
      { status: 500 }
    );
  }
}

