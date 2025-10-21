import { NextRequest, NextResponse } from 'next/server';

/**
 * Handles OneSignal source map files
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { file: string } }
) {
  try {
    const file = params.file;
    
    console.log('🔍 OneSignal source map request:', { file, url: request.url });
    
    // For now, just return a 404 for source maps since they're not critical
    // Source maps are only needed for debugging
    console.log(`ℹ️ Source map requested but not critical: ${file}`);
    
    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error('❌ OneSignal source map error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
