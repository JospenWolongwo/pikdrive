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

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  console.log(`🚀 OneSignal API CORS preflight: OPTIONS /api/onesignal/api/${params.slug.join('/')}`);
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OneSignal-Event, X-OneSignal-Proxy',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleApiRequest(
  request: NextRequest,
  slug: string[],
  method: string
) {
  try {
    // Add defensive logging at the very start
    console.log(`🚀 OneSignal API proxy handler called: ${method} /api/onesignal/api/${slug.join('/')}`);
    console.log(`🔍 Request URL: ${request.url}`);
    // Reconstruct the API path
    const apiPath = slug.join('/');
    const apiUrl = `${ONESIGNAL_API_BASE}/${apiPath}`;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${apiUrl}?${queryString}` : apiUrl;

    console.log(`🔄 Proxying OneSignal API ${method}: ${fullUrl}`);
    console.log(`🔍 Request headers:`, Object.fromEntries(request.headers.entries()));

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
    
    // Add required OneSignal headers
    const origin = request.headers.get('x-forwarded-host')
      ? `https://${request.headers.get('x-forwarded-host')}`
      : new URL(request.url).origin;
    
    headers.set('Origin', origin);
    headers.set('Referer', `${origin}/`);
    headers.set('Host', 'api.onesignal.com');

    // Add our proxy identifier
    headers.set('X-OneSignal-Proxy', 'PikDrive-API-Proxy/1.0');
    
    console.log(`🔍 Headers being sent to OneSignal:`, Object.fromEntries(headers.entries()));

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
    
    console.log(`🔍 OneSignal API response status: ${response.status}`);
    console.log(`🔍 OneSignal API response headers:`, Object.fromEntries(response.headers.entries()));

    // Get response content
    const responseText = await response.text();
    console.log(`🔍 OneSignal API response content (first 500 chars):`, responseText.substring(0, 500));
    
    // Set response headers
    const responseHeaders = new Headers();
    
    // Copy Content-Type from OneSignal's response instead of hardcoding
    const contentType = response.headers.get('content-type') || 'application/json';
    
    // For JSONP requests, ensure we return application/javascript even if OneSignal returns an error
    const isJsonp = searchParams.has('callback');
    if (isJsonp && !response.ok) {
      // If JSONP request failed, return error as JSONP callback
      const errorCallback = searchParams.get('callback') || 'callback';
      const errorResponse = `${errorCallback}({"error": "OneSignal API error", "status": ${response.status}});`;
      responseHeaders.set('Content-Type', 'application/javascript');
      console.log(`🔧 Returning JSONP error response for failed request`);
      return new NextResponse(errorResponse, {
        status: 200, // Always return 200 for JSONP
        headers: responseHeaders,
      });
    }
    
    responseHeaders.set('Content-Type', contentType);
    
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
    
    // For JSONP requests, return error as callback even on proxy errors
    const { searchParams } = new URL(request.url);
    const isJsonp = searchParams.has('callback');
    
    if (isJsonp) {
      const errorCallback = searchParams.get('callback') || 'callback';
      const errorResponse = `${errorCallback}({"error": "Proxy error", "message": "${error instanceof Error ? error.message : 'Unknown error'}"});`;
      return new NextResponse(errorResponse, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    return NextResponse.json(
      { 
        error: 'OneSignal API proxy error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}