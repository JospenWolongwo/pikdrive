import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies OneSignal CSS files to bypass ad blockers and privacy extensions
 */

const ONESIGNAL_CDN_BASE = 'https://cdn.onesignal.com/sdks/web/v16';

export async function GET(
  request: NextRequest,
  { params }: { params: { file: string } }
) {
  try {
    const file = params.file;
    
    console.log('🔍 OneSignal CSS proxy request:', { file, url: request.url });
    
    // Validate file parameter
    const allowedFiles = [
      'OneSignalSDK.page.styles.css'
    ];
    
    if (!allowedFiles.includes(file)) {
      console.error(`❌ Blocked request for unauthorized CSS file: ${file}`);
      return NextResponse.json({ error: 'File not allowed' }, { status: 403 });
    }
    
    // Fetch the CSS file from OneSignal CDN
    const cdnUrl = `${ONESIGNAL_CDN_BASE}/${file}`;
    console.log(`🔄 Fetching OneSignal CSS: ${cdnUrl}`);
    
    const response = await fetch(cdnUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OneSignal-Proxy/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch OneSignal CSS: ${file}`, response.status);
      return NextResponse.json({ error: 'Failed to fetch CSS' }, { status: response.status });
    }

    let content = await response.text();
    console.log(`✅ Fetched OneSignal CSS: ${file} (${content.length} bytes)`);
    
    // Set appropriate headers for CSS
    const headers = new Headers();
    headers.set('Content-Type', 'text/css');
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    headers.set('Access-Control-Allow-Origin', '*');

    console.log(`✅ Returning OneSignal CSS: ${file}`);

    return new NextResponse(content, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('❌ OneSignal CSS proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
