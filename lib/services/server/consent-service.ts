import type { SupabaseClient } from '@supabase/supabase-js';

export type ConsentType = 'terms_and_privacy' | 'driver_terms';

export interface RecordConsentParams {
  readonly userId: string;
  readonly consentType: ConsentType;
  readonly termsVersion?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface ConsentRecord {
  readonly id: string;
  readonly user_id: string;
  readonly consent_type: ConsentType;
  readonly accepted_at: string;
  readonly terms_version: string;
  readonly created_at: string;
}

/**
 * Server-side ConsentService for use in API routes
 * Handles recording and fetching user consent records for legal compliance
 */
export class ConsentService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Record a user's consent (terms, privacy, or driver-specific terms)
   */
  async recordConsent(params: RecordConsentParams): Promise<ConsentRecord> {
    const {
      userId,
      consentType,
      termsVersion = '1.0',
      ipAddress = 'unknown',
      userAgent = 'unknown',
    } = params;

    const { data, error } = await this.supabase
      .from('user_consents')
      .insert({
        user_id: userId,
        consent_type: consentType,
        accepted_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        terms_version: termsVersion,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store consent record: ${error.message}`);
    }

    return data as ConsentRecord;
  }

  /**
   * Get all consent records for a user (for settings/audit)
   */
  async getConsentsByUserId(userId: string): Promise<ConsentRecord[]> {
    const { data, error } = await this.supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch consent records: ${error.message}`);
    }

    return (data ?? []) as ConsentRecord[];
  }
}
