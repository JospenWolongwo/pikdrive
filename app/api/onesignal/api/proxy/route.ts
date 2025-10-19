import { NextRequest, NextResponse } from 'next/server';

const ONESIGNAL_API_BASE = 'https://api.onesignal.com';

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

async function proxyRequest(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    
    // Validate path to prevent arbitrary requests
    const allowedPaths = new Set([
      '/sync',
      '/notifications',
      '/players'
    ]);
    
    if (!allowedPaths.has(path)) {
      return NextResponse.json({ error: 'Invalid API path' }, { status: 400 });
    }

    const apiUrl = `${ONESIGNAL_API_BASE}${path}${request.url.split('?')[1] || ''}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.NEXT_PUBLIC_ONESIGNAL_API_KEY}`,
        'User-Agent': 'PikDrive-OneSignal-Proxy/1.0'
      },
    };

    if (method === 'POST') {
      options.body = await request.text();
    }

    const response = await fetch(apiUrl, options);

    if (!response.ok) {
      console.error(`OneSignal API proxy failed: ${path}`, response.status);
      return NextResponse.json({ error: 'API request failed' }, { status: response.status });
    }

    const content = await response.text();
    return new NextResponse(content, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    });
  } catch (error) {
    console.error('OneSignal API proxy error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
