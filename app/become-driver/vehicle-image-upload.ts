/**
 * Vehicle image upload utility with proper RLS policy handling
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_CONTROL_IMMUTABLE } from "@/lib/storage";

/**
 * Upload a vehicle image with proper bucket access
 */
export async function uploadVehicleImage(
  supabase: SupabaseClient,
  file: File,
  userId: string
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  try {
    // Generate unique file path with proper structure for RLS policies
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const filename = `${timestamp}_${uuidv4().split('-')[0]}.${fileExt}`;
    const filePath = `${userId}/${filename}`;
    
    // First try the driver_documents bucket which we know works
    const { data, error: uploadError } = await supabase.storage
      .from('driver_documents')
      .upload(filePath, file, {
        cacheControl: CACHE_CONTROL_IMMUTABLE,
        upsert: true
      });
      
    if (uploadError) {
      console.error(`❌ Vehicle image upload error:`, uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get the public URL of the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('driver_documents')
      .getPublicUrl(filePath);
    
    console.log(`✅ Vehicle image uploaded successfully: ${publicUrl}`);
    
    return {
      success: true,
      url: publicUrl
    };
  } catch (error: any) {
    console.error('Vehicle image upload error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during vehicle image upload'
    };
  }
}

/**
 * Upload multiple vehicle images in parallel
 */
export async function uploadVehicleImages(
  supabase: SupabaseClient,
  files: File[],
  userId: string
): Promise<{
  success: boolean;
  urls: string[];
  errors: string[];
}> {
  const uploadPromises = files.map(file => uploadVehicleImage(supabase, file, userId));
  
  try {
    const results = await Promise.allSettled(uploadPromises);
    
    const urls: string[] = [];
    const errors: string[] = [];
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.success && result.value.url) {
          urls.push(result.value.url);
        } else if (result.value.error) {
          errors.push(result.value.error);
        }
      } else {
        errors.push(result.reason.message || 'Upload promise rejected');
      }
    });
    
    return {
      success: errors.length === 0,
      urls,
      errors
    };
  } catch (error: any) {
    console.error('Error in batch vehicle image upload:', error);
    return {
      success: false,
      urls: [],
      errors: [error.message || 'Unknown batch upload error']
    };
  }
}
