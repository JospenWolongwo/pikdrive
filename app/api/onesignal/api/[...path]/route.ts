import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { path: string[] }}) {
  const path = params.path.join("/");
  const url = new URL(req.url);
  const search = url.search || "";
  const target = `https://api.onesignal.com/${path}${search}`;

  try {
    const res = await fetch(target, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0",
        "Accept": "application/json, */*;q=0.1",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "http://localhost:3000/",
      },
    });
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: any) {
    return new Response(`Proxy error: ${error?.message || "unknown"}`, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] }}) {
  const path = params.path.join("/");
  const url = new URL(req.url);
  const search = url.search || "";
  const target = `https://api.onesignal.com/${path}${search}`;

  try {
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await req.text(),
    };
    const res = await fetch(target, {
      ...init,
      headers: {
        ...(init.headers as any),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0",
        "Accept": "application/json, */*;q=0.1",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "http://localhost:3000/",
      },
    });
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: any) {
    return new Response(`Proxy error: ${error?.message || "unknown"}`, { status: 500 });
  }
}


