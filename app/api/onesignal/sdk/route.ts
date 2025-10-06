import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const cdnUrl = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

  try {
    const res = await fetch(cdnUrl, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0",
        "Accept": "application/javascript, text/javascript, */*;q=0.1",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "http://localhost:3000/",
      },
    });

    if (!res.ok) {
      return new Response("Failed to fetch OneSignal SDK", { status: 502 });
    }

    let body = await res.text();

    // Rewrite CDN asset URLs to our local proxy to avoid tracker blocking
    // Replace base path occurrences like https://cdn.onesignal.com/sdks/web/v16/
    body = body.replaceAll(
      "https://cdn.onesignal.com/sdks/web/v16/",
      "/api/onesignal/assets/"
    );

    // Rewrite API base to local proxy as well
    // Both plain and escaped patterns
    body = body.replaceAll(
      "https://api.onesignal.com/",
      "/api/onesignal/api/"
    );
    body = body.replaceAll(
      "https:\/\/api.onesignal.com\/",
      "\/api\/onesignal\/api\/"
    );

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        // Short cache; browser may revalidate on navigation
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error: any) {
    return new Response(
      `Error proxying OneSignal SDK: ${error?.message || "unknown"}`,
      { status: 500 }
    );
  }
}


