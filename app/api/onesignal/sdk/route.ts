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
    
    console.log('🔍 OneSignal SDK proxy request:', { file, url: request.url });
    console.log('🔍 Query parameters:', searchParams.toString());
    
    if (!file) {
      console.error('❌ No file parameter provided');
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
      console.error('❌ Invalid file requested:', file);
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    }

    // Fetch from OneSignal CDN
    const cdnUrl = `${ONESIGNAL_CDN_BASE}/${file}`;
    console.log('🔄 Fetching from OneSignal CDN:', cdnUrl);
    
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'PikDrive-OneSignal-Proxy/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch OneSignal file: ${file}`, response.status);
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
    }

    let content = await response.text();
    console.log(`✅ Fetched OneSignal file: ${file} (${content.length} bytes)`);
    console.log(`🔍 File extension: ${file.split('.').pop()}, contains API calls: ${content.includes('api.onesignal.com')}`);
    
    // Rewrite CDN URLs to use our proxy routes
    const originalCdnCount = (content.match(/https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g) || []).length;
    content = content.replace(
      /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g,
      '/api/onesignal/sdk/'
    );
    console.log(`🔄 Rewrote ${originalCdnCount} CDN URLs to proxy paths`);
    
    // Rewrite API URLs to use our proxy to avoid network timeouts
    const originalApiCount = (content.match(/https:\/\/api\.onesignal\.com\//g) || []).length;
    content = content.replace(
      /https:\/\/api\.onesignal\.com\//g,
      '/api/onesignal/api/'
    );
    console.log(`🔄 Rewrote ${originalApiCount} API URLs to proxy paths`);
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/javascript');
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    headers.set('Access-Control-Allow-Origin', '*');
    
    console.log(`✅ Returning rewritten OneSignal SDK: ${file}`);
    return new NextResponse(content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('❌ OneSignal proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
