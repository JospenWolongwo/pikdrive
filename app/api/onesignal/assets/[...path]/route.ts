import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { path: string[] }}) {
  // Proxy any asset under the OneSignal SDK v16 path
  const path = params.path.join("/");
  const cdnUrl = `https://cdn.onesignal.com/sdks/web/v16/${path}`;

  try {
    const res = await fetch(cdnUrl, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "http://localhost:3000/",
      },
    });

    if (!res.ok) {
      return new Response("Failed to fetch OneSignal asset", { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const isJs = contentType.includes("javascript") || path.endsWith(".js");

    if (isJs) {
      let text = await res.text();
      // Rewrite further CDN references and API base inside asset scripts
      text = text.replaceAll(
        "https://cdn.onesignal.com/sdks/web/v16/",
        "/api/onesignal/assets/"
      );
      text = text.replaceAll(
        "https://api.onesignal.com/",
        "/api/onesignal/api/"
      );
      text = text.replaceAll(
        "https:\/\/api.onesignal.com\/",
        "\/api\/onesignal\/api\/"
      );
      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const body = await res.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error: any) {
    return new Response(
      `Error proxying OneSignal asset: ${error?.message || "unknown"}`,
      { status: 500 }
    );
  }
}


