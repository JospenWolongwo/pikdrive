import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal Service Worker Direct Route
 * Handles direct requests to /OneSignalSDK.sw.js
 * Serves the service worker content directly (no redirects allowed for SW)
 */

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('🔍 OneSignal SW direct request:', { url: request.url, params: searchParams.toString() });
    
    // Fetch from OneSignal CDN
    const cdnUrl = `${ONESIGNAL_CDN_BASE}/OneSignalSDK.sw.js`;
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'PikDrive-OneSignal-Proxy/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch OneSignal SW from CDN:`, response.status);
      return NextResponse.json({ error: 'Failed to fetch service worker' }, { status: response.status });
    }

    let content = await response.text();
    console.log(`✅ Fetched OneSignal SW content directly (${content.length} bytes)`);
    
    // Rewrite CDN URLs to use our proxy routes
    content = content.replace(
      /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g,
      '/api/onesignal/sw/'
    );
    
    // Set appropriate headers for service worker
    const headers = new Headers();
    headers.set('Content-Type', 'application/javascript');
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Service-Worker-Allowed', '/');
    
    console.log('✅ Serving OneSignal SW content directly (no redirect)');
    return new NextResponse(content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('❌ OneSignal SW direct serving error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
