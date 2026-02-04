// Supabase Auth Send SMS Hook: OTP delivery via Twilio and/or WhatsApp
// Phase 1: Twilio only. Phase 2: percentage-based WhatsApp with Twilio fallback.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_MESSAGE_SERVICE_SID = Deno.env.get("TWILIO_MESSAGE_SERVICE_SID");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
const SEND_SMS_HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET");
const OTP_WHATSAPP_PERCENTAGE = parseInt(
  Deno.env.get("OTP_WHATSAPP_PERCENTAGE") ?? "0",
  10
);
const OTP_USE_WHATSAPP_KILL_SWITCH =
  Deno.env.get("OTP_USE_WHATSAPP_KILL_SWITCH") === "true";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") || "v21.0";
const OTP_WHATSAPP_TEMPLATE_NAME =
  Deno.env.get("OTP_WHATSAPP_TEMPLATE_NAME") || "auth_otp";

interface SendSmsHookPayload {
  readonly user: { readonly phone?: string; readonly id?: string };
  readonly sms: { readonly otp?: string };
}

type Channel = "twilio" | "whatsapp";
type Outcome = "success" | "fallback_used" | "failure";

function logOutcome(channel: Channel, outcome: Outcome, phonePrefix: string): void {
  console.log("[send-otp-hook] channel=%s outcome=%s phone_prefix=%s", channel, outcome, phonePrefix);
}

function stableBucket(phone: string): number {
  const encoder = new TextEncoder();
  const data = encoder.encode(phone);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i];
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}

function shouldUseWhatsApp(phone: string): boolean {
  if (OTP_USE_WHATSAPP_KILL_SWITCH) return false;
  if (!OTP_WHATSAPP_PERCENTAGE || OTP_WHATSAPP_PERCENTAGE <= 0) return false;
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) return false;
  const bucket = stableBucket(phone);
  return bucket < OTP_WHATSAPP_PERCENTAGE;
}

async function sendViaTwilio(phone: string, otp: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials not configured");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams();
  body.set("To", phone);
  body.set("Body", otp);
  if (TWILIO_MESSAGE_SERVICE_SID) {
    body.set("MessagingServiceSid", TWILIO_MESSAGE_SERVICE_SID);
  } else if (TWILIO_FROM_NUMBER) {
    body.set("From", TWILIO_FROM_NUMBER);
  } else {
    throw new Error("Twilio: set TWILIO_MESSAGE_SERVICE_SID or TWILIO_FROM_NUMBER");
  }
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio send failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

function phoneToWhatsAppTo(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function sendViaWhatsApp(phone: string, otp: string): Promise<void> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WhatsApp credentials not configured");
  }
  const to = phoneToWhatsAppTo(phone);
  const apiUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: OTP_WHATSAPP_TEMPLATE_NAME,
      language: { code: "fr" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

function hookError(message: string, httpCode: number): Response {
  return new Response(
    JSON.stringify({
      error: { http_code: httpCode, message },
    }),
    {
      status: httpCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return hookError("Method not allowed", 405);
  }

  if (SEND_SMS_HOOK_SECRET) {
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (bearer !== SEND_SMS_HOOK_SECRET) {
      return hookError("Unauthorized", 401);
    }
  }

  let payload: SendSmsHookPayload;
  try {
    payload = (await req.json()) as SendSmsHookPayload;
  } catch {
    return hookError("Invalid JSON body", 400);
  }

  const phone = payload?.user?.phone;
  const otp = payload?.sms?.otp;
  if (!phone || otp === undefined || otp === null) {
    return hookError("Missing user.phone or sms.otp", 400);
  }

  const phonePrefix = phone.slice(0, Math.min(6, phone.length)) + "***";

  try {
    const useWhatsApp = shouldUseWhatsApp(phone);

    if (useWhatsApp) {
      try {
        await sendViaWhatsApp(phone, String(otp));
        logOutcome("whatsapp", "success", phonePrefix);
        return new Response(null, { status: 200 });
      } catch (waErr) {
        console.warn("[send-otp-hook] WhatsApp failed, falling back to Twilio:", waErr instanceof Error ? waErr.message : waErr);
        try {
          await sendViaTwilio(phone, String(otp));
          logOutcome("whatsapp", "fallback_used", phonePrefix);
          return new Response(null, { status: 200 });
        } catch (twErr) {
          console.error("[send-otp-hook] Fallback Twilio failed:", twErr instanceof Error ? twErr.message : twErr);
          logOutcome("whatsapp", "failure", phonePrefix);
          return hookError("OTP delivery failed", 500);
        }
      }
    }

    await sendViaTwilio(phone, String(otp));
    logOutcome("twilio", "success", phonePrefix);
    return new Response(null, { status: 200 });
  } catch (err) {
    console.error("[send-otp-hook] Twilio send failed:", err instanceof Error ? err.message : err);
    logOutcome("twilio", "failure", phonePrefix);
    return hookError("OTP delivery failed", 500);
  }
});
