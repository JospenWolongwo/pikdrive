# WhatsApp Webhook Setup

## 1. Webhook endpoint

- **URL:** `https://<YOUR_DOMAIN>/api/webhooks/whatsapp`
- **Methods:** `GET` (verification), `POST` (events)

Examples:

- Production: `https://pikdrive.com/api/webhooks/whatsapp`
- Local (via ngrok): `https://abc123.ngrok.io/api/webhooks/whatsapp`

---

## 2. Environment variables

Add to `.env.local` and production:

```bash
# Webhook verification (you choose the value; must match App Dashboard)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=pikdrive_whatsapp_verify_2025

# App Secret: Meta App Dashboard > Settings > Basic > App Secret
# Used to validate X-Hub-Signature-256 on POST
META_APP_SECRET=your_app_secret_here
```

- **`WHATSAPP_WEBHOOK_VERIFY_TOKEN`**  
  - Any non‑empty string you keep secret.  
  - Must be the same as the **Verify token** in the App Dashboard.

- **`META_APP_SECRET`**  
  - From: App Dashboard → Settings → Basic → **App Secret** (click “Show”).

---

## 3. Configure in Meta App Dashboard

1. Open [developers.facebook.com](https://developers.facebook.com) → your app.
2. **WhatsApp** → **Configuration** (or **Use cases** → **Customize** → **Configuration**).
3. **Webhook** section:
   - **Callback URL:**  
     `https://<YOUR_DOMAIN>/api/webhooks/whatsapp`
   - **Verify token:**  
     Same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (e.g. `pikdrive_whatsapp_verify_2025`).
4. Click **Verify and save**.  
   - Meta sends a `GET` to your URL; if the endpoint returns `hub.challenge` when `hub.verify_token` matches, it will mark the webhook as verified.
5. **Subscribe to fields** (at least):
   - `messages` – incoming messages.
   - `message_template_status_update` – optional, template status.

---

## 4. Local testing with ngrok

Your URL must be **public** and **HTTPS**. For local:

```bash
# Install ngrok, then:
ngrok http 3000
```

Use the `https://` URL ngrok gives you, e.g.:

- Callback URL: `https://abc123.ngrok.io/api/webhooks/whatsapp`
- Verify token: same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

After changing Callback URL or Verify token in the App Dashboard, Meta sends a new `GET` to verify.

---

## 5. Behaviour of the endpoint

### GET (verification)

- Meta sends: `?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...`
- We compare `hub.verify_token` to `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- If they match: respond **200** with body = `hub.challenge` (plain text).
- If not: **403**.

### POST (events)

- We check `X-Hub-Signature-256`:  
  `sha256=<HMAC-SHA256 of body using META_APP_SECRET>`.
- If `META_APP_SECRET` is set and the signature is wrong: **403**.
- If valid (or `META_APP_SECRET` not set and no signature): parse JSON, handle `object=whatsapp_business_account` and `field=messages` (and optionally status/errors), log to `whatsapp_webhook_logs`, then respond **200**.

---

## 6. Database: `whatsapp_webhook_logs`

Migration: `20260114000000_create_whatsapp_webhook_logs.sql`.

Apply:

```bash
supabase db push
```

---

## 7. Checklist

- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set (same as in App Dashboard).
- [ ] `META_APP_SECRET` set (from App Dashboard → Settings → Basic).
- [ ] Callback URL in App Dashboard = `https://<YOUR_DOMAIN>/api/webhooks/whatsapp`.
- [ ] Verify token in App Dashboard = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- [ ] **Verify and save** clicked; verification succeeded.
- [ ] Subscribed to `messages` (and optionally `message_template_status_update`).
- [ ] Migration applied so `whatsapp_webhook_logs` exists.

---

## 8. Troubleshooting

- **Verification fails**
  - Callback URL must be exact, including `https://` and path.
  - Verify token must match character‑for‑character (no extra spaces).

- **POST returns 403**
  - `META_APP_SECRET` must be the App Secret from the same app.
  - We compute: `sha256=<HMAC-SHA256(body, META_APP_SECRET)>` and compare to `X-Hub-Signature-256`.

- **No events in `whatsapp_webhook_logs`**
  - Ensure `messages` (and any other needed fields) are subscribed in Configuration.
  - Send a test message to your WhatsApp number and check server logs and `whatsapp_webhook_logs`.

---

## Reference

- [Create webhook endpoint (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint#configure-webhooks)
- [Configure webhooks (Meta)](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint#configure-webhooks)
