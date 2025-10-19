import { NextRequest, NextResponse } from 'next/server';

const ONESIGNAL_API_BASE = 'https://api.onesignal.com';

export async function GET(request: NextRequest, { params }: { params: { slug: string[] } }) {
  return proxy(request, params.slug, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { slug: string[] } }) {
  return proxy(request, params.slug, 'POST');
}

async function proxy(request: NextRequest, slug: string[], method: 'GET'|'POST') {
  try {
    // Whitelist top-level resources
    const top = slug[0];
    const allowedTop = new Set(['sync','notifications','players']);
    if (!allowedTop.has(top)) {
      return NextResponse.json({ error: 'Path not allowed' }, { status: 400 });
    }

    const search = new URL(request.url).search || '';
    const targetUrl = `${ONESIGNAL_API_BASE}/${slug.join('/')}${search}`;

    const headers: Record<string,string> = {
      'User-Agent': 'PikDrive-OneSignal-Proxy/1.0',
    };

    // Forward auth header if present in env for server-side calls
    const apiKey = process.env.NEXT_PUBLIC_ONESIGNAL_API_KEY;
    if (apiKey) headers['Authorization'] = `Basic ${apiKey}`;

    const init: RequestInit = { method, headers };
    if (method === 'POST') {
      init.body = await request.text();
      headers['Content-Type'] = request.headers.get('content-type') || 'application/json';
    }

    const resp = await fetch(targetUrl, init);
    const body = await resp.text();

    // Preserve content type from origin (important for JSONP /sync)
    const ct = resp.headers.get('content-type') || (top === 'sync' ? 'application/javascript' : 'application/json');

    return new NextResponse(body, {
      status: resp.status,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('OneSignal API proxy error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
