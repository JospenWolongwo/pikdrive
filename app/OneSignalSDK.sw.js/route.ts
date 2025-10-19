import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal Service Worker Direct Route
 * Handles direct requests to /OneSignalSDK.sw.js
 * Proxies to the main service worker proxy route
 */

export async function GET(request: NextRequest) {
  try {
    // Redirect to the main service worker proxy route
    const proxyUrl = new URL('/api/onesignal/sw/OneSignalSDK.sw.js', request.url);
    
    // Copy query parameters if any
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.toString()) {
      proxyUrl.search = searchParams.toString();
    }
    
    console.log('🔄 Redirecting OneSignal SW request to proxy:', proxyUrl.toString());
    
    return NextResponse.redirect(proxyUrl, 302);
  } catch (error) {
    console.error('❌ OneSignal SW redirect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
