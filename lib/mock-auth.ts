// Mock storage for verification codes
const verificationCodes = new Map<string, {
  code: string;
  attempts: number;
  expiresAt: Date;
  verified: boolean;
}>();

export async function sendVerificationCode(phone: string): Promise<{ error: string | null }> {
  try {
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the code with 10 minutes expiration
    verificationCodes.set(phone, {
      code,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      verified: false
    });

    // In development, log the code to console
    console.log(`[DEV ONLY] Verification code for ${phone}: ${code}`);
    
    return { error: null };
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { error: 'Failed to send verification code' };
  }
}

export async function verifyCode(phone: string, code: string): Promise<{
  error: string | null;
  verified: boolean;
}> {
  try {
    const storedData = verificationCodes.get(phone);
    
    if (!storedData) {
      return { error: 'No verification code found', verified: false };
    }

    if (storedData.verified) {
      return { error: 'Code already verified', verified: false };
    }

    if (storedData.expiresAt < new Date()) {
      verificationCodes.delete(phone);
      return { error: 'Code expired', verified: false };
    }

    if (storedData.attempts >= 3) {
      return { error: 'Too many attempts', verified: false };
    }

    storedData.attempts += 1;
    
    if (storedData.code !== code) {
      return { error: 'Invalid code', verified: false };
    }

    storedData.verified = true;
    return { error: null, verified: true };
  } catch (error) {
    console.error('Error verifying code:', error);
    return { error: 'Failed to verify code', verified: false };
  }
}