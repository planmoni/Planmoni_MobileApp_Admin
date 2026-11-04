/**
 * Sends a transactional email when an admin approves or rejects a manual KYC review.
 *
 * Called from DB triggers via pg_net after:
 * - Tier 3 utility bill review (utility_bill_review_status)
 * - Tier 1 BVN face review (bvn_face_review_status)
 *
 * Body: { user_id, status: 'approved'|'rejected', note?, kind?: 'tier3'|'tier1_bvn' }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  alertBox,
  ctaButton,
  escapeHtml,
  greeting,
  paragraph,
  titleBlock,
  wrapEmail,
} from '../_shared/email/layout.ts';
import { SITE_URL } from '../_shared/email/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReviewKind = 'tier3' | 'tier1_bvn';
type ReviewStatus = 'approved' | 'rejected';

type RequestBody = {
  user_id?: string;
  status?: string;
  note?: string | null;
  kind?: string | null;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeKind(value: string | null | undefined): ReviewKind {
  if (value === 'tier1_bvn' || value === 'tier1' || value === 'bvn') return 'tier1_bvn';
  return 'tier3';
}

function deepLinkFor(kind: ReviewKind): string {
  return kind === 'tier1_bvn' ? 'myapp://kyc/tier1' : 'myapp://kyc/tier3';
}

function buildEmail(input: {
  kind: ReviewKind;
  status: ReviewStatus;
  firstName: string;
  note: string | null;
}): { subject: string; html: string } {
  const approved = input.status === 'approved';
  const note = input.note?.trim() || null;

  if (input.kind === 'tier1_bvn') {
    if (approved) {
      const subject = 'Your Planmoni identity check is approved';
      const html = wrapEmail({
        title: subject,
        preheader: 'Your Tier 1 BVN review was approved',
        bodyHtml: `
          ${titleBlock('Identity check approved')}
          ${greeting(input.firstName)}
          ${paragraph(
            'Your Tier 1 identity verification was approved after manual review. You can now use your Planmoni deposit account on Home and Add funds.',
          )}
          ${ctaButton(deepLinkFor('tier1_bvn'), 'Open Planmoni')}
          ${paragraph('If the button does not open the app, open Planmoni from your phone.')}
        `,
      });
      return { subject, html };
    }

    const subject = 'Your Planmoni identity check needs another try';
    const reasonHtml = note
      ? alertBox(`<strong>Reason:</strong> ${escapeHtml(note)}`, 'error')
      : '';
    const html = wrapEmail({
      title: subject,
      preheader: 'Your Tier 1 BVN face review was not approved',
      bodyHtml: `
        ${titleBlock('Identity review unsuccessful')}
        ${greeting(input.firstName)}
        ${paragraph(
          'We could not approve your Tier 1 BVN face match after manual review. Please open Planmoni and try again with a clearer selfie that matches your BVN photo.',
        )}
        ${reasonHtml}
        ${ctaButton(deepLinkFor('tier1_bvn'), 'Continue verification')}
      `,
    });
    return { subject, html };
  }

  // Tier 3 proof of address
  if (approved) {
    const subject = 'Your proof of address was approved';
    const html = wrapEmail({
      title: subject,
      preheader: 'You are now on Tier 3',
      bodyHtml: `
        ${titleBlock('Proof of address approved')}
        ${greeting(input.firstName)}
        ${paragraph(
          'Your Tier 3 proof of address was approved. Your account limits have been updated — thank you for completing verification.',
        )}
        ${ctaButton(`${SITE_URL}`, 'Open Planmoni')}
        ${paragraph('Open the Planmoni app on your phone to continue.')}
      `,
    });
    return { subject, html };
  }

  const subject = 'Your proof of address needs another try';
  const reasonHtml = note
    ? alertBox(`<strong>Reason:</strong> ${escapeHtml(note)}`, 'error')
    : '';
  const html = wrapEmail({
    title: subject,
    preheader: 'Your Tier 3 submission was not approved',
    bodyHtml: `
      ${titleBlock('Proof of address rejected')}
      ${greeting(input.firstName)}
      ${paragraph(
        'Your proof of address was not approved. Please submit a clearer utility bill or bank statement that matches the address on your profile.',
      )}
      ${reasonHtml}
      ${ctaButton(deepLinkFor('tier3'), 'Resubmit documents')}
    `,
  });
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: 'Service temporarily unavailable' });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.includes(serviceKey) && !authHeader.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' });
    }

    const body = (await req.json()) as RequestBody;
    const userId = body.user_id;
    const status = body.status === 'approved' || body.status === 'rejected' ? body.status : null;
    if (!userId || !status) {
      return json(400, { error: 'user_id and status (approved|rejected) are required' });
    }

    const kind = normalizeKind(body.kind);
    const note = typeof body.note === 'string' ? body.note : null;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email, first_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('[notify-kyc-review] profile lookup failed', profileError.message);
      return json(500, { error: 'Failed to load user profile' });
    }

    let email = profile?.email ? String(profile.email) : null;
    let firstName = profile?.first_name ? String(profile.first_name) : '';

    if (!email) {
      try {
        const { data: authData } = await admin.auth.admin.getUserById(userId);
        email = authData?.user?.email ?? null;
        if (!firstName) {
          firstName = String(authData?.user?.user_metadata?.first_name || '');
        }
      } catch (err) {
        console.error('[notify-kyc-review] auth lookup failed', err);
      }
    }

    if (!email) {
      console.error('[notify-kyc-review] no email for user', userId);
      return json(200, { success: false, skipped: true, reason: 'no_email' });
    }

    const { subject, html } = buildEmail({
      kind,
      status,
      firstName,
      note,
    });

    const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: email, subject, html }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text().catch(() => '');
      console.error('[notify-kyc-review] send-email failed', emailRes.status, errText);
      return json(502, { error: 'Failed to send email', details: errText });
    }

    const result = await emailRes.json().catch(() => ({}));
    console.log('[notify-kyc-review] sent', { userId, kind, status, emailId: result?.id });
    return json(200, { success: true, kind, status, id: result?.id ?? null });
  } catch (error) {
    console.error('[notify-kyc-review] unexpected error', error);
    return json(500, {
      error: error instanceof Error ? error.message : 'Failed to notify KYC review',
    });
  }
});
