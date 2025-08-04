import { SupabaseClient } from '@supabase/supabase-js'

export interface DriverApplicationData {
  driver_id: string
  national_id_number?: string
  license_number?: string
  registration_number?: string
  insurance_number?: string
  technical_inspection_number?: string
  road_tax_number?: string
  national_id_file_recto?: string
  national_id_file_verso?: string
  license_file_recto?: string
  license_file_verso?: string
  registration_file_recto?: string
  registration_file_verso?: string
  insurance_file_recto?: string
  insurance_file_verso?: string
  technical_inspection_file?: string
  vehicle_images?: string[]
}

export interface ProfileUpdateData {
  driver_application_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'inactive'
  driver_application_date?: string
  is_driver_applicant: boolean
  is_driver?: boolean
  driver_status?: 'pending' | 'approved' | 'rejected' | 'inactive'
  role?: 'user' | 'driver' | 'admin'
}

/**
 * Validates that all required driver application fields are present
 */
export function validateDriverApplication(data: DriverApplicationData): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check for at least one document file
  const hasNationalId = data.national_id_file_recto || data.national_id_file_verso
  const hasLicense = data.license_file_recto || data.license_file_verso
  const hasRegistration = data.registration_file_recto || data.registration_file_verso
  const hasInsurance = data.insurance_file_recto || data.insurance_file_verso
  
  if (!hasNationalId) {
    errors.push('National ID document is required')
  }
  
  if (!hasLicense) {
    errors.push('Driver license document is required')
  }
  
  if (!hasRegistration) {
    errors.push('Vehicle registration document is required')
  }
  
  if (!hasInsurance) {
    errors.push('Insurance document is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Submits a driver application with proper error handling and validation
 */
export async function submitDriverApplication(
  supabase: SupabaseClient,
  userId: string,
  driverData: DriverApplicationData
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // Validate the application data
    const validation = validateDriverApplication(driverData)
    if (!validation.isValid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      }
    }

    // Prepare the driver document data with default values for required fields
    const driverDocument = {
      driver_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'pending',
      // Provide default values for required document number fields
      national_id_number: driverData.national_id_number || '',
      license_number: driverData.license_number || '',
      registration_number: driverData.registration_number || '',
      insurance_number: driverData.insurance_number || '',
      technical_inspection_number: driverData.technical_inspection_number || '',
      road_tax_number: driverData.road_tax_number || '',
      // File uploads
      national_id_file_recto: driverData.national_id_file_recto,
      national_id_file_verso: driverData.national_id_file_verso,
      license_file_recto: driverData.license_file_recto,
      license_file_verso: driverData.license_file_verso,
      registration_file_recto: driverData.registration_file_recto,
      registration_file_verso: driverData.registration_file_verso,
      insurance_file_recto: driverData.insurance_file_recto,
      insurance_file_verso: driverData.insurance_file_verso,
      technical_inspection_file: driverData.technical_inspection_file,
      vehicle_images: driverData.vehicle_images
    }

    // Prepare the profile update data
    const profileUpdate: ProfileUpdateData = {
      driver_application_status: 'pending',
      driver_application_date: new Date().toISOString(),
      is_driver_applicant: true,
      is_driver: false,
      driver_status: 'pending',
      role: 'user'
    }

    console.log('📝 Submitting driver application...', {
      userId,
      documentCount: Object.keys(driverData).filter(key => key.includes('file')).length,
      hasVehicleImages: Boolean(driverData.vehicle_images?.length)
    })

    // First, update the profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)

    if (profileError) {
      console.error('❌ Error updating profile:', profileError)
      return {
        success: false,
        error: `Failed to update profile: ${profileError.message}`
      }
    }

    // Then, insert the driver document
    const { data: docData, error: docError } = await supabase
      .from('driver_documents')
      .insert(driverDocument)
      .select()

    if (docError) {
      console.error('❌ Error inserting driver document:', docError)
      
      // Try to rollback the profile update
      await supabase
        .from('profiles')
        .update({
          driver_application_status: null,
          driver_application_date: null,
          is_driver_applicant: false
        })
        .eq('id', userId)
      
      return {
        success: false,
        error: `Failed to insert driver document: ${docError.message}`
      }
    }

    console.log('✅ Driver application submitted successfully:', {
      documentId: docData?.[0]?.id,
      status: 'pending'
    })

    return {
      success: true,
      data: docData?.[0]
    }

  } catch (error) {
    console.error('❌ Unexpected error submitting driver application:', error)
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Updates driver status (approve/reject) with proper error handling
 */
export async function updateDriverStatus(
  supabase: SupabaseClient,
  driverId: string,
  status: 'approved' | 'rejected' | 'inactive'
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🔄 Updating driver ${driverId} status to ${status}`)

    // Update profile status
    const profileUpdate: Partial<ProfileUpdateData> = {
      driver_status: status,
      driver_application_status: status,
      is_driver: status === 'approved',
      role: status === 'approved' ? 'driver' : 'user'
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', driverId)

    if (profileError) {
      console.error('❌ Error updating profile status:', profileError)
      return {
        success: false,
        error: `Failed to update profile status: ${profileError.message}`
      }
    }

    // Also update document status for consistency
    const { error: docError } = await supabase
      .from('driver_documents')
      .update({ status })
      .eq('driver_id', driverId)

    if (docError) {
      console.error('❌ Error updating document status:', docError)
      // Don't fail the entire operation if document update fails
    }

    console.log('✅ Driver status updated successfully')
    return { success: true }

  } catch (error) {
    console.error('❌ Unexpected error updating driver status:', error)
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Gets driver application data with proper error handling
 */
export async function getDriverApplication(
  supabase: SupabaseClient,
  driverId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', driverId)
      .single()

    if (profileError) {
      return {
        success: false,
        error: `Failed to fetch profile: ${profileError.message}`
      }
    }

    // Get driver documents
    const { data: documents, error: docError } = await supabase
      .from('driver_documents')
      .select('*')
      .eq('driver_id', driverId)
      .single()

    return {
      success: true,
      data: {
        profile,
        documents: docError ? null : documents
      }
    }

  } catch (error) {
    console.error('❌ Error fetching driver application:', error)
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
} 