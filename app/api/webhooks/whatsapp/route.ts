import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * WhatsApp Business API Webhook
 *
 * GET:  Meta verifies the endpoint. Must return hub.challenge when hub.verify_token matches.
 * POST: Meta sends events (messages, status, etc.). Must validate X-Hub-Signature-256.
 *
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint
 */

/** Verify token you set in App Dashboard. Must match WHATSAPP_WEBHOOK_VERIFY_TOKEN. */
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
/** App Secret from Meta App Dashboard > Settings > Basic. Used to validate POST signature. */
const APP_SECRET = process.env.META_APP_SECRET;

/**
 * GET: Webhook verification (Meta sends when you set Callback URL / Verify token)
 *
 * Query: hub.mode=subscribe, hub.challenge=<random>, hub.verify_token=<yours>
 * If hub.verify_token matches VERIFY_TOKEN → respond 200 with hub.challenge.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const token = searchParams.get('hub.verify_token');

  if (mode !== 'subscribe' || !challenge) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  if (!VERIFY_TOKEN) {
    console.error('[WEBHOOK-WHATSAPP] WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  if (token !== VERIFY_TOKEN) {
    console.warn('[WEBHOOK-WHATSAPP] Verify token mismatch');
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log('[WEBHOOK-WHATSAPP] Verification successful');
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * POST: Webhook events (messages, status updates, etc.)
 *
 * Must validate X-Hub-Signature-256 (HMAC-SHA256 of body using APP_SECRET).
 * Respond 200 to acknowledge; otherwise Meta retries.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-hub-signature-256');
  const rawBody = await request.text();

  if (!rawBody) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Validate signature
  if (APP_SECRET && signature) {
    const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
    if (signature !== expected) {
      console.warn('[WEBHOOK-WHATSAPP] Invalid X-Hub-Signature-256');
      return new NextResponse('Forbidden', { status: 403 });
    }
  } else if (signature && !APP_SECRET) {
    console.error('[WEBHOOK-WHATSAPP] META_APP_SECRET not set; cannot validate signature');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Meta may send { object: 'whatsapp_business_account', entry: [...] }
  if (payload.object !== 'whatsapp_business_account') {
    // Ignore non-WhatsApp webhooks (e.g. page subscriptions) but still 200
    return NextResponse.json({ ok: true });
  }

  const entries = payload.entry ?? [];
  for (const entry of entries) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      const messages = value?.messages ?? [];
      const statuses = value?.statuses ?? [];
      const errors = value?.errors ?? [];

      for (const msg of messages) {
        await logAndProcessMessage(msg, value?.metadata, 'message');
      }
      for (const st of statuses) {
        await logAndProcessMessage(st, value?.metadata, 'status');
      }
      for (const err of errors) {
        await logAndProcessMessage(err, value?.metadata, 'error');
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function logAndProcessMessage(
  data: Record<string, unknown>,
  metadata: { phone_number_id?: string; display_phone_number?: string } | undefined,
  kind: 'message' | 'status' | 'error'
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const toLog = {
    kind,
    message_id: (data as any).id ?? null,
    from_number: (data as any).from ?? null,
    timestamp: String((data as any).timestamp ?? ''),
    type: (data as any).type ?? null,
    status: (data as any).status ?? null,
    metadata: metadata ?? null,
    raw: data,
  };

  try {
    await supabase.from('whatsapp_webhook_logs').insert(toLog);
  } catch (e) {
    // If table doesn't exist, only log to console
    console.log('[WEBHOOK-WHATSAPP] Event:', JSON.stringify(toLog, null, 2));
  }

  // Optional: handle incoming messages (e.g. auto-reply, support bot)
  if (kind === 'message') {
    console.log('[WEBHOOK-WHATSAPP] Incoming message:', (data as any).id, (data as any).type);
  }
  if (kind === 'status') {
    console.log('[WEBHOOK-WHATSAPP] Status update:', (data as any).id, (data as any).status);
  }
}
