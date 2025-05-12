#!/usr/bin/env node

/**
 * This script ensures the required Supabase storage buckets exist
 * Run this during deployment or server startup to prevent storage errors
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Important: Use service role key for admin operations

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function ensureStorageBuckets() {
  console.log('🔍 Checking storage buckets...');
  
  // List of required buckets with their configurations
  const requiredBuckets = [
    {
      id: 'driver_documents',
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    },
    {
      id: 'profile_images',
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    },
    {
      id: 'vehicle_images',
      public: true,
      fileSizeLimit: 20971520, // 20MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg']
    }
  ];
  
  // Check each required bucket
  for (const bucketConfig of requiredBuckets) {
    try {
      // Check if bucket exists
      const { data: bucket, error: getBucketError } = await supabase.storage.getBucket(bucketConfig.id);
      
      if (getBucketError) {
        // Bucket doesn't exist, create it
        console.log(`⚙️ Creating storage bucket: ${bucketConfig.id}`);
        
        const { error: createError } = await supabase.storage.createBucket(bucketConfig.id, {
          public: bucketConfig.public,
          fileSizeLimit: bucketConfig.fileSizeLimit,
          allowedMimeTypes: bucketConfig.allowedMimeTypes
        });
        
        if (createError) {
          console.error(`❌ Failed to create bucket ${bucketConfig.id}:`, createError.message);
          continue;
        }
        
        console.log(`✅ Successfully created bucket: ${bucketConfig.id}`);
        
        // Set up policies for the new bucket
        await setupBucketPolicies(bucketConfig.id);
      } else {
        console.log(`✅ Bucket exists: ${bucketConfig.id}`);
        
        // Update bucket configuration if needed
        const { error: updateError } = await supabase.storage.updateBucket(bucketConfig.id, {
          public: bucketConfig.public,
          fileSizeLimit: bucketConfig.fileSizeLimit,
          allowedMimeTypes: bucketConfig.allowedMimeTypes
        });
        
        if (updateError) {
          console.warn(`⚠️ Could not update bucket config for ${bucketConfig.id}:`, updateError.message);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing bucket ${bucketConfig.id}:`, error.message);
    }
  }
}

async function setupBucketPolicies(bucketId) {
  console.log(`⚙️ Setting up policies for bucket: ${bucketId}`);
  
  try {
    // This requires SQL execution which isn't directly available through JS client
    // Instead, we'll use the Management API if available, or provide instructions
    
    console.log(`ℹ️ Policy setup instructions for ${bucketId}:`);
    console.log(`1. Execute the following SQL in your Supabase SQL editor:`);
    console.log(`
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for uploading files
CREATE POLICY "Authenticated users can upload to ${bucketId}" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = '${bucketId}');

-- Policy for viewing files
CREATE POLICY "Anyone can view ${bucketId}" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = '${bucketId}');
    `);
  } catch (error) {
    console.error(`❌ Error setting up policies for ${bucketId}:`, error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting storage bucket setup...');
    await ensureStorageBuckets();
    console.log('✅ Storage setup completed successfully');
  } catch (error) {
    console.error('❌ Storage setup failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
