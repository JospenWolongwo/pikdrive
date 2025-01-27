import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// For backwards compatibility
export const createClient = () => supabase

export async function sendVerificationCode(phone: string): Promise<{ error: string | null }> {
  try {
    // Create verification code in database
    const { data, error } = await supabase
      .rpc('create_verification', { phone_number: phone })
    
    if (error) throw error

    // TODO: Integrate with actual SMS gateway
    // For now, we'll log the verification code to the console
    console.log(`Verification code for ${phone} created with ID: ${data}`)
    
    return { error: null }
  } catch (error) {
    console.error('Error sending verification code:', error)
    return { error: 'Failed to send verification code' }
  }
}

export async function verifyCode(phone: string, code: string): Promise<{ 
  error: string | null,
  verified: boolean 
}> {
  try {
    const { data, error } = await supabase
      .rpc('verify_code', { 
        phone_number: phone,
        submitted_code: code 
      })
    
    if (error) throw error

    return { 
      error: null,
      verified: data 
    }
  } catch (error) {
    console.error('Error verifying code:', error)
    return { 
      error: 'Failed to verify code',
      verified: false
    }
  }
}