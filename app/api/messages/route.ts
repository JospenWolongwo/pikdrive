import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { conversation_id, content, message_type = 'text' } = await request.json();

    if (!conversation_id || !content) {
      return NextResponse.json(
        { success: false, error: "conversation_id and content are required" },
        { status: 400 }
      );
    }

    // Get the current user from the request headers
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Authorization header required" },
        { status: 401 }
      );
    }

    // Create a Supabase client with the user's token
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Invalid authentication" },
        { status: 401 }
      );
    }

    // Filter sensitive information
    const filteredContent = filterSensitiveInfo(content);

    // Insert the message
    const { data, error } = await supabaseClient
      .from("messages")
      .insert([
        {
          conversation_id,
          sender_id: user.id,
          content: filteredContent,
          message_type,
        },
      ])
      .select(
        `
        *,
        sender:profiles!messages_sender_id_fkey (
          id,
          full_name,
          avatar_url
        )
        `
      )
      .single();

    if (error) {
      console.error("Error inserting message:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error in POST /api/messages:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to filter sensitive information
function filterSensitiveInfo(text: string): string {
  // Filter phone numbers
  text = text.replace(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    '[PHONE NUMBER REMOVED]'
  );

  // Filter email addresses
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL REMOVED]'
  );

  // Filter URLs
  text = text.replace(
    /(https?:\/\/[^\s]+)/g,
    '[LINK REMOVED]'
  );

  // Filter social media handles
  text = text.replace(
    /(?:@[\w_]+|#[\w_]+)/g,
    '[SOCIAL MEDIA HANDLE REMOVED]'
  );

  return text;
}

