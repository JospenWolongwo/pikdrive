import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Critical server-side environment variable checks
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Use service role key for admin operations with explicit error logging
let supabaseAdmin: ReturnType<typeof createClient>; 

// Initialize with more robust error handling
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`❌ Invalid Supabase credentials: URL=${!!supabaseUrl}, Key=${!!supabaseServiceKey}`);
    throw new Error('Missing required Supabase credentials');
  }
  
  // Initialize the admin client with better options
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('✅ Supabase admin client initialized successfully');
} catch (initError) {
  console.error('Failed to initialize Supabase admin client:', initError);
  // Create a fallback client that will properly report errors
  supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGc.invalid-placeholder-key',
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * API route to check and optionally create storage buckets
 * This is a secure server-side operation that uses the service role key
 */
export async function POST(request: NextRequest) {
  try {
    // Validate environment variables are properly set
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables for Supabase admin operations');
      return NextResponse.json({ 
        error: 'Server configuration error: Missing required environment variables', 
        envVars: {
          urlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          keySet: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
        }
      }, { status: 500 });
    }

    const { bucketId } = await request.json();
    
    if (!bucketId) {
      return NextResponse.json({ error: 'Bucket ID is required' }, { status: 400 });
    }
    
    console.log(`Checking if bucket exists: ${bucketId}`);
    
    // First check if the bucket exists - with detailed error handling
    const { data: bucket, error: getBucketError } = await supabaseAdmin.storage.getBucket(bucketId);
    
    if (getBucketError) {
      // Log the specific error for debugging
      console.log(`Bucket ${bucketId} check error:`, getBucketError);
      
      // Simple validation - just try to create it
      console.log(`Attempting to create storage bucket: ${bucketId}`);
      
      try {
        const { data, error: createError } = await supabaseAdmin.storage.createBucket(bucketId, {
          public: true,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
        });
        
        if (createError) {
          console.error(`Failed to create bucket ${bucketId}:`, createError);
          // Add specific data about the error for better debugging
          return NextResponse.json({
            error: `Failed to create storage bucket: ${createError.message}`,
            details: createError,
            envVarsPresent: {
              urlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
              keySet: !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
            }
          }, { status: 500 });
        }
        
        // We'll skip policy creation for now since it's causing issues
        console.log(`✅ Bucket created successfully: ${bucketId}`);
        
        return NextResponse.json({ success: true, created: true, bucketId });
      } catch (createBucketError: any) {
        console.error(`Exception creating bucket ${bucketId}:`, createBucketError);
        return NextResponse.json({
          error: `Exception creating bucket: ${createBucketError.message}`,
          stack: createBucketError.stack
        }, { status: 500 });
      }
    }
    
    // Bucket exists, good to proceed
    console.log(`✅ Bucket ${bucketId} already exists`);
    return NextResponse.json({ success: true, created: false, bucketId });
  } catch (error: any) {
    console.error('Error in bucket-check API:', error);
    return NextResponse.json({
      error: error.message || 'Internal server error',
      stack: error.stack
    }, { status: 500 });
  }
}

// RPC function and policy creation removed to simplify the implementation
// The setup-storage.js script should be used to set up policies instead
