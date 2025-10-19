import { NextRequest, NextResponse } from 'next/server';

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(request: NextRequest, { params }: { params: { file: string } }) {
  try {
    const file = params.file;
    const allowed = new Set(['OneSignalSDK.sw.js', 'OneSignalSDK.updater.sw.js']);
    if (!allowed.has(file)) return NextResponse.json({ error: 'Invalid SW file' }, { status: 400 });

    const res = await fetch(`${ONESIGNAL_CDN_BASE}/${file}`, {
      headers: { 'User-Agent': 'PikDrive-OneSignal-Proxy/1.0' },
    });
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: res.status });

    let content = await res.text();
    
    // Rewrite CDN URLs to use our proxy routes
    content = content.replace(
      /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\//g,
      '/api/onesignal/sw/'
    );
    
    // Note: We no longer rewrite API URLs - let OneSignal SDK make direct API calls
    // This allows proper authentication while still bypassing tracking protection for SDK loading
    
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=86400',
        'Service-Worker-Allowed': '/',
      },
    });
  } catch (e) {
    console.error('OneSignal SW proxy error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
