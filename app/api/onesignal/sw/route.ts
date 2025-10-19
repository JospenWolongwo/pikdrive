import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal Service Worker Proxy Route
 * Serves OneSignal service worker files as first-party resources
 */

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file') || 'OneSignalSDK.sw.js';
    
    // Validate file parameter
    const allowedFiles = [
      'OneSignalSDK.sw.js',
      'OneSignalSDK.updater.sw.js'
    ];

    if (!allowedFiles.includes(file)) {
      return NextResponse.json({ error: 'Invalid service worker file' }, { status: 400 });
    }

    // Fetch from OneSignal CDN
    const cdnUrl = `${ONESIGNAL_CDN_BASE}/${file}`;
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'PikDrive-OneSignal-Proxy/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch OneSignal SW: ${file}`, response.status);
      return NextResponse.json({ error: 'Failed to fetch service worker' }, { status: response.status });
    }

    let content = await response.text();
    
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
    
    return new NextResponse(content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('OneSignal SW proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
