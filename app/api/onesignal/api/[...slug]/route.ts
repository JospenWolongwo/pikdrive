import { NextRequest, NextResponse } from 'next/server';

/**
 * OneSignal API Proxy Route
 * Proxies OneSignal API calls to bypass tracking protection
 * 
 * This handles all OneSignal API calls like:
 * - /api/onesignal/api/sync/{appId}/web
 * - /api/onesignal/api/players
 * - /api/onesignal/api/notifications
 */

const ONESIGNAL_API_BASE = 'https://api.onesignal.com';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleApiRequest(request, params.slug, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleApiRequest(request, params.slug, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleApiRequest(request, params.slug, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleApiRequest(request, params.slug, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleApiRequest(request, params.slug, 'DELETE');
}

async function handleApiRequest(
  request: NextRequest,
  slug: string[],
  method: string
) {
  try {
    // Reconstruct the API path
    const apiPath = slug.join('/');
    const apiUrl = `${ONESIGNAL_API_BASE}/${apiPath}`;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${apiUrl}?${queryString}` : apiUrl;

    console.log(`🔄 Proxying OneSignal API ${method}: ${fullUrl}`);

    // Prepare headers
    const headers = new Headers();
    
    // Copy relevant headers from the original request
    const relevantHeaders = [
      'authorization',
      'content-type',
      'accept',
      'user-agent',
      'origin',
      'referer'
    ];
    
    relevantHeaders.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    });

    // Add our proxy identifier
    headers.set('X-OneSignal-Proxy', 'PikDrive-API-Proxy/1.0');

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers,
      cache: 'no-cache',
    };

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.text();
        if (body) {
          requestOptions.body = body;
        }
      } catch (error) {
        console.warn('Failed to read request body:', error);
      }
    }

    // Make the API call
    const response = await fetch(fullUrl, requestOptions);

    // Get response content
    const responseText = await response.text();
    
    // Set response headers
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json');
    responseHeaders.set('Cache-Control', 'no-cache');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OneSignal-Event');

    console.log(`✅ OneSignal API ${method} response: ${response.status}`);

    return new NextResponse(responseText, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error(`❌ OneSignal API ${method} proxy error:`, error);
    return NextResponse.json(
      { 
        error: 'OneSignal API proxy error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}