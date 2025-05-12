/**
 * Upload utilities for the driver application process
 * Provides fallback mechanisms for storage issues
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for document upload parameters
 */
export interface UploadParams {
  file: File;
  userId: string;
  bucketName: string;
  docType: string;
}

/**
 * Interface for upload result
 */
export interface UploadResult {
  url: string;
  success: boolean;
  isMock: boolean;
  error?: string;
}

/**
 * Upload a document to Supabase storage
 * With fallback to mock URLs when storage is unavailable
 */
export async function uploadDocument(
  supabase: SupabaseClient,
  params: UploadParams
): Promise<UploadResult> {
  const { file, userId, bucketName, docType } = params;
  
  // Generate a unique file path
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown';
  const timestamp = Date.now();
  const uuid = uuidv4().split('-')[0]; // Use first segment of UUID for brevity
  const filePath = `${userId}/${docType}_${timestamp}_${uuid}.${fileExt}`;
  
  try {
    // First check if bucket exists by trying to list files
    const { data: bucketCheck, error: bucketError } = await supabase.storage.from(bucketName).list(userId, {
      limit: 1,
      offset: 0,
    });
    
    if (bucketError && bucketError.message.includes('The resource was not found')) {
      console.warn(`⚠️ Storage bucket '${bucketName}' not found, attempting public bucket mode`);
      
      // Try public bucket mode as fallback
      try {
        const publicBucket = 'public';
        const { data, error: uploadError } = await supabase.storage
          .from(publicBucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from(publicBucket).getPublicUrl(filePath);
          return { url: publicUrl, success: true, isMock: false };
        }
      } catch (publicBucketError) {
        console.error('Public bucket upload failed:', publicBucketError);
      }
      
      // Final fallback - create a mock URL
      console.warn('⚠️ All storage options failed, using mock URL for development');
      const mockUrl = generateMockUrl(file, userId, docType);
      return { url: mockUrl, success: true, isMock: true };
    }
    
    // Normal upload path - bucket exists
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });
      
    if (uploadError) {
      console.error(`❌ Upload error:`, uploadError);
      
      // Try one more time with a different path
      const retryPath = `${userId}/${docType}_retry_${timestamp}_${uuid}.${fileExt}`;
      const { data: retryData, error: retryError } = await supabase.storage
        .from(bucketName)
        .upload(retryPath, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (retryError) {
        // Both attempts failed, use mock URL
        console.warn('⚠️ Retry upload failed, using mock URL for development');
        const mockUrl = generateMockUrl(file, userId, docType);
        return { url: mockUrl, success: true, isMock: true };
      }
      
      // Retry succeeded
      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(retryPath);
      return { url: publicUrl, success: true, isMock: false };
    }
    
    // First attempt succeeded
    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return { url: publicUrl, success: true, isMock: false };
  } catch (error: any) {
    console.error('Unexpected upload error:', error);
    const mockUrl = generateMockUrl(file, userId, docType);
    return { 
      url: mockUrl, 
      success: false, 
      isMock: true,
      error: error.message || 'Unknown upload error'
    };
  }
}

/**
 * Generate a mock URL for development when storage is unavailable
 */
function generateMockUrl(file: File, userId: string, docType: string): string {
  const timestamp = Date.now();
  const fileInfo = encodeURIComponent(
    JSON.stringify({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    })
  );
  
  return `mock://${docType}/${userId}/${timestamp}?info=${fileInfo}`;
}

/**
 * Check if a URL is a mock URL
 */
export function isMockUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.startsWith('mock://');
}

/**
 * Validate a document URL
 */
export function isValidDocumentUrl(url: string | undefined): boolean {
  if (!url) return false;
  
  // Mock URLs are valid for development
  if (isMockUrl(url)) return true;
  
  // Real URLs must be from Supabase and have the correct format
  return url.includes('supabase.co/storage/v1/object');
}
