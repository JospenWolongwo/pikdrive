import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { PaymentReconciliationCronService } from "@/lib/services/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

// This endpoint should be called by a cron job every 5 minutes
export async function GET(request: Request) {
  try {
    const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    const missingEnv = requiredEnv.filter((key) => !process.env[key]);
    if (missingEnv.length > 0) {
      console.error("❌ Cron env validation failed:", { missingEnv });
      return NextResponse.json(
        { error: "Missing required environment variables", missingEnv },
        { status: 500 }
      );
    }

    if (process.env.USE_PAWAPAY === "true" && !process.env.PAWAPAY_API_TOKEN) {
      console.warn("⚠️ USE_PAWAPAY is enabled but PAWAPAY_API_TOKEN is missing");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const cronService = new PaymentReconciliationCronService(supabase);
    const result = await cronService.run();

    return NextResponse.json(result);
  } catch (error) {
    console.error("âŒ Cron job error:", error);
    return NextResponse.json(
      { error: "Failed to process stale payments" },
      { status: 500 }
    );
  }
}
