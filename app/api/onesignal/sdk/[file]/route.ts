import { NextRequest, NextResponse } from 'next/server';

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest, { params }: { params: { file: string } }) {
  try {
    const file = params.file;
    const allowed = new Set(['OneSignalSDK.page.js', 'OneSignalSDK.page.es6.js']);
    if (!allowed.has(file)) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });

    const res = await fetch(`${ONESIGNAL_CDN_BASE}/${file}`, {
      headers: { 'User-Agent': 'PikDrive-OneSignal-Proxy/1.0' },
    });
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: res.status });

    let content = await res.text();

    // Rewrite CDN URLs to use our proxy routes
    content = content.replace(
      /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g,
      '/api/onesignal/sdk/'
    );
    
    // Get request origin for absolute URLs
    const origin = request.headers.get('x-forwarded-host')
      ? `https://${request.headers.get('x-forwarded-host')}`
      : new URL(request.url).origin;
    
    // Rewrite OneSignal API URLs to use our improved proxy
    content = content.replace(
      /https:\/\/api\.onesignal\.com\//g,
      `${origin}/api/onesignal/api/`
    );

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('OneSignal SDK proxy error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
