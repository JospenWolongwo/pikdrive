import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal Service Worker Dynamic Route
 * Handles requests to OneSignal service worker files
 * Supports both OneSignalSDKWorker.js and OneSignalSDK.sw.js
 */

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest, { params }: { params: { onesignal: string[] } }) {
  try {
    const { searchParams } = new URL(request.url);
    const path = params.onesignal.join('/');
    
    console.log('🔍 OneSignal dynamic route request:', { 
      url: request.url, 
      path,
      params: searchParams.toString() 
    });
    
    // Handle OneSignalSDKWorker.js requests
    if (path === 'OneSignalSDKWorker.js') {
      const workerContent = `importScripts("/api/onesignal/sw/OneSignalSDK.sw.js?${searchParams.toString()}");`;
      
      console.log(`✅ Serving OneSignal Worker content directly (${workerContent.length} bytes)`);
      
      const headers = new Headers();
      headers.set('Content-Type', 'application/javascript');
      headers.set('Cache-Control', 'public, max-age=86400');
      headers.set('Service-Worker-Allowed', '/');
      
      return new NextResponse(workerContent, {
        status: 200,
        headers,
      });
    }
    
    // Handle OneSignalSDK.sw.js requests
    if (path === 'OneSignalSDK.sw.js') {
      const cdnUrl = `${ONESIGNAL_CDN_BASE}/OneSignalSDK.sw.js?${searchParams.toString()}`;
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
      
      // Rewrite API URLs to use our proxy to avoid network timeouts
      content = content.replace(
        /https:\/\/api\.onesignal\.com\//g,
        '/api/onesignal/api/'
      );
      
      const headers = new Headers();
      headers.set('Content-Type', 'application/javascript');
      headers.set('Cache-Control', 'public, max-age=86400');
      headers.set('Service-Worker-Allowed', '/');
      
      console.log('✅ Serving OneSignal SW content directly');
      return new NextResponse(content, {
        status: 200,
        headers,
      });
    }
    
    // If we get here, the path is not recognized
    console.error('❌ Unknown OneSignal path:', path);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
  } catch (error) {
    console.error('❌ OneSignal dynamic route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
