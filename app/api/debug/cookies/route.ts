import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('auth') ||
      cookie.name.includes('supabase') ||
      cookie.name.includes('sb-')
    );

    return NextResponse.json({
      totalCookies: allCookies.length,
      authCookies: authCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value,
        valueLength: c.value?.length || 0,
        valuePreview: c.value ? `${c.value.substring(0, 20)}...` : 'empty',
      })),
      currentSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40),
      storedSupabaseUrl: cookieStore.get('supabase-project-url')?.value?.substring(0, 40),
      environmentMatch: process.env.NEXT_PUBLIC_SUPABASE_URL === cookieStore.get('supabase-project-url')?.value,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

