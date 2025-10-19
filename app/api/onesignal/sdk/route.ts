import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal SDK Proxy Route
 * Serves OneSignal SDK files as first-party resources to bypass ad blockers
 * 
 * This is the official OneSignal recommendation for ad blocker compatibility
 */

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    
    if (!file) {
      return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
    }

    // Validate file parameter to prevent path traversal
    const allowedFiles = [
      'OneSignalSDK.page.js',
      'OneSignalSDK.page.es6.js',
      'OneSignalSDK.sw.js',
      'OneSignalSDK.updater.sw.js'
    ];

    if (!allowedFiles.includes(file)) {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    }

    // Fetch from OneSignal CDN
    const cdnUrl = `${ONESIGNAL_CDN_BASE}/${file}`;
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'PikDrive-OneSignal-Proxy/1.0',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch OneSignal file: ${file}`, response.status);
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
    }

    let content = await response.text();
    
    // Rewrite CDN URLs to use our proxy routes
    content = content.replace(
      /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g,
      '/api/onesignal/sdk/'
    );
    
    // Rewrite OneSignal API URLs to use our proxy
    content = content.replace(
      /https:\/\/api\.onesignal\.com\//g,
      '/api/onesignal/api/'
    );
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/javascript');
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    headers.set('Access-Control-Allow-Origin', '*');
    
    return new NextResponse(content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('OneSignal proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
