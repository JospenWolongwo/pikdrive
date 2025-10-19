import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal SDK Direct File Route
 * Handles direct file requests like /api/onesignal/sdk/OneSignalSDK.page.js
 * Serves the file directly without redirect
 */

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest) {
  try {
    const fileName = 'OneSignalSDK.page.js';
    
    console.log('🔍 OneSignal SDK direct file request:', { fileName, url: request.url });
    
    // Fetch from OneSignal CDN
    const cdnUrl = `${ONESIGNAL_CDN_BASE}/${fileName}`;
    console.log('🔄 Fetching from OneSignal CDN:', cdnUrl);
    
    const response = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'PikDrive-OneSignal-Proxy/1.0',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch OneSignal file: ${fileName}`, response.status);
      return NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status });
    }

    let content = await response.text();
    console.log(`✅ Fetched OneSignal file: ${fileName} (${content.length} bytes)`);
    
    // Rewrite CDN URLs to use our proxy routes
    const originalCdnCount = (content.match(/https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g) || []).length;
    content = content.replace(
      /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g,
      '/api/onesignal/sdk/'
    );
    console.log(`🔄 Rewrote ${originalCdnCount} CDN URLs to proxy paths`);
    
    // Rewrite OneSignal API URLs to use our proxy
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
    
    console.log(`✅ Returning rewritten OneSignal SDK: ${fileName}`);
    return new NextResponse(content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('❌ OneSignal SDK direct file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
