import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest) {
  const cdnUrl = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js";

  try {
    const res = await fetch(cdnUrl, { cache: "no-store" });

    if (!res.ok) {
      return new Response("Failed to fetch OneSignal SW", { status: 502 });
    }

    const body = await res.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    return new Response("Error proxying OneSignal SW", { status: 500 });
  }
}




