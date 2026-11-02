import { supabase } from '@/lib/supabase';

export type MarketingEmailFields = {
  subject: string;
  heading: string;
  body: string;
  button_label: string;
  button_url: string;
};

export const EMPTY_EMAIL: MarketingEmailFields = { subject: '', heading: '', body: '', button_label: '', button_url: '' };

/** The server-side field names (camelCase for the renderer) */
export function toEdgeEmail(f: MarketingEmailFields) {
  return {
    subject: f.subject,
    heading: f.heading,
    body: f.body,
    buttonLabel: f.button_label,
    buttonUrl: f.button_url,
  };
}

/** Reads back what a campaign saved with the composer (campaigns created before it have no `metadata.email`). */
export function emailFromCampaign(campaign: any): MarketingEmailFields | null {
  const e = campaign?.metadata?.email;
  if (!e) return null;
  return {
    subject: e.subject || '',
    heading: e.heading || '',
    body: e.body || '',
    button_label: e.buttonLabel || '',
    button_url: e.buttonUrl || '',
  };
}

/** Calls the marketing-campaigns edge function as the signed-in admin. Throws with the server's message. */
export async function callMarketingCampaigns<T = any>(body: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error || 'Something went wrong. Please try again.');
  }
  return data as T;
}
