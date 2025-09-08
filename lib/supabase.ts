import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase-config";

export const supabase = createSupabaseClient(
  supabaseConfig.supabaseUrl,
  supabaseConfig.supabaseKey,
  {
    auth: supabaseConfig.auth,
  }
);

// For backwards compatibility
export const createClient = () => supabase;

export async function sendVerificationCode(
  phone: string
): Promise<{ error: string | null }> {
  try {
    // Create verification code in database
    const { data, error } = await supabase.rpc("create_verification", {
      phone_number: phone,
    });

    if (error) throw error;

    // TODO: Integrate with actual SMS gateway
    // For now, we'll log the verification code to the console
    console.log(`Verification code for ${phone} created with ID: ${data}`);

    return { error: null };
  } catch (error) {
    console.error("Error sending verification code:", error);
    return { error: "Failed to send verification code" };
  }
}

export async function verifyCode(
  phone: string,
  code: string
): Promise<{
  error: string | null;
  verified: boolean;
}> {
  try {
    const { data, error } = await supabase.rpc("verify_code", {
      phone_number: phone,
      submitted_code: code,
    });

    if (error) throw error;

    return {
      error: null,
      verified: data,
    };
  } catch (error) {
    console.error("Error verifying code:", error);
    return {
      error: "Failed to verify code",
      verified: false,
    };
  }
}
