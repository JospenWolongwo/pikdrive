import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { PaymentReconciliationCronService } from "@/lib/services/server";

export const dynamic = "force-dynamic";
export const runtime = "edge";

// This endpoint should be called by a cron job every 5 minutes
export async function GET(request: Request) {
  try {
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
