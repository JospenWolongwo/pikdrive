import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server-client';
import { ConsentService } from '@/lib/services/server/consent';

/**
 * POST /api/legal/consent
 * Store user consent record for legal compliance
 *
 * Body: {
 *   consentType: 'terms_and_privacy' | 'driver_terms',
 *   termsVersion?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No auth token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { consentType, termsVersion = '1.0' } = body;

    if (!consentType || !['terms_and_privacy', 'driver_terms'].includes(consentType)) {
      return NextResponse.json(
        { error: 'Invalid consent type. Must be "terms_and_privacy" or "driver_terms"' },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const consentService = new ConsentService(supabase);
    const consent = await consentService.recordConsent({
      userId: user.id,
      consentType,
      termsVersion,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      consent: {
        id: consent.id,
        consent_type: consent.consent_type,
        accepted_at: consent.accepted_at,
        terms_version: consent.terms_version,
      },
    });
  } catch (error) {
    console.error('Error in consent API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/legal/consent
 * Get user's consent history (for settings/audit)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const consentService = new ConsentService(supabase);
    const consents = await consentService.getConsentsByUserId(user.id);

    return NextResponse.json({
      success: true,
      consents,
    });
  } catch (error) {
    console.error('Error in consent GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
