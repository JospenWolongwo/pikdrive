// Supabase Edge Function for sending WhatsApp messages via Meta WhatsApp Business API
// Professional, scalable WhatsApp notification system

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.5";

// Environment variables
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const WHATSAPP_BUSINESS_ACCOUNT_ID = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_API_VERSION = Deno.env.get("WHATSAPP_API_VERSION") || "v21.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface WhatsAppTemplateRequest {
  readonly templateName: string;
  readonly phoneNumber: string;
  readonly variables: readonly string[];
  readonly language?: string;
}

interface WhatsAppApiResponse {
  readonly messaging_product: string;
  readonly contacts: Array<{ input: string; wa_id: string }>;
  readonly messages: Array<{ id: string }>;
  readonly error?: {
    readonly message: string;
    readonly type: string;
    readonly code: number;
    readonly error_subcode?: number;
    readonly fbtrace_id?: string;
  };
}

/**
 * Send WhatsApp template message via Meta API
 */
async function sendWhatsAppTemplate(
  request: WhatsAppTemplateRequest
): Promise<{ messageId: string; status: string }> {
  const apiUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Build template message payload
  const payload = {
    messaging_product: "whatsapp",
    to: request.phoneNumber,
    type: "template",
    template: {
      name: request.templateName,
      language: {
        code: request.language || "fr",
      },
      components: [
        {
          type: "body",
          parameters: request.variables.map((value) => ({
            type: "text",
            text: value,
          })),
        },
      ],
    },
  };

  console.log("📤 Sending to WhatsApp API:", {
    url: apiUrl,
    templateName: request.templateName,
    phoneNumber: request.phoneNumber,
    variableCount: request.variables.length,
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  console.log("📡 WhatsApp API response status:", response.status);

  const responseText = await response.text();
  console.log("📡 WhatsApp API response (first 500 chars):", responseText.substring(0, 500));

  if (!response.ok) {
    try {
      const error = JSON.parse(responseText) as WhatsAppApiResponse;
      const errorMessage = error.error?.message || "Unknown WhatsApp API error";
      const errorCode = error.error?.code || response.status;
      const errorType = error.error?.type || "unknown";
      
      // Log detailed error for debugging
      console.error("❌ WhatsApp API Error:", {
        code: errorCode,
        type: errorType,
        message: errorMessage,
        subcode: error.error?.error_subcode,
        traceId: error.error?.fbtrace_id,
      });

      // Create error with code for retry logic
      const apiError = new Error(`WhatsApp API error (${errorCode}): ${errorMessage}`);
      (apiError as any).errorCode = errorCode;
      (apiError as any).status = response.status;
      throw apiError;
    } catch (e) {
      if (e instanceof Error && (e as any).errorCode) {
        throw e; // Re-throw if already formatted
      }
      throw new Error(`WhatsApp API returned error: ${responseText.substring(0, 200)}`);
    }
  }

  try {
    const result = JSON.parse(responseText) as WhatsAppApiResponse;
    const messageId = result.messages?.[0]?.id;
    
    if (!messageId) {
      throw new Error("WhatsApp API did not return message ID");
    }

    return {
      messageId,
      status: "sent",
    };
  } catch (e) {
    console.error("❌ Failed to parse WhatsApp response:", e);
    throw new Error(`WhatsApp returned invalid JSON: ${responseText.substring(0, 200)}`);
  }
}

/**
 * Log WhatsApp notification to database
 */
async function logWhatsAppNotification(
  supabase: any,
  request: WhatsAppTemplateRequest,
  messageId: string,
  status: string
): Promise<void> {
  try {
    // Extract user_id from phone number if possible (optional enhancement)
    // For now, we'll log without user_id since we don't have reverse lookup
    await supabase.from("notification_logs").insert({
      whatsapp_message_id: messageId,
      whatsapp_status: status,
      channel: "whatsapp",
      notification_type: request.templateName,
      title: `WhatsApp: ${request.templateName}`,
      message: `Template: ${request.templateName} with ${request.variables.length} variables`,
      recipients: 1,
      status: status === "sent" ? "sent" : "failed",
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error("Failed to log WhatsApp notification:", error);
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "WhatsApp credentials not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const whatsappRequest: WhatsAppTemplateRequest = await req.json();

    console.log("📤 Received WhatsApp request:", {
      templateName: whatsappRequest.templateName,
      phoneNumber: whatsappRequest.phoneNumber,
      variableCount: whatsappRequest.variables.length,
    });

    // Validate required fields
    if (
      !whatsappRequest.templateName ||
      !whatsappRequest.phoneNumber ||
      !whatsappRequest.variables
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: templateName, phoneNumber, variables",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send WhatsApp message
    const result = await sendWhatsAppTemplate(whatsappRequest);

    // Log to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await logWhatsAppNotification(
      supabase,
      whatsappRequest,
      result.messageId,
      result.status
    );

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        status: result.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error sending WhatsApp message:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Determine error code
    let errorCode = 500;
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      errorCode = 429;
    } else if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
      errorCode = 401;
    } else if (errorMessage.includes("400") || errorMessage.includes("bad request")) {
      errorCode = 400;
    }

    // Log error details for monitoring
    console.error("❌ WhatsApp API Error Details:", {
      errorMessage,
      errorCode,
      templateName: whatsappRequest?.templateName,
      phoneNumber: whatsappRequest?.phoneNumber?.substring(0, 5) + "***", // Partial for privacy
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorCode: errorCode,
      }),
      {
        status: errorCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
