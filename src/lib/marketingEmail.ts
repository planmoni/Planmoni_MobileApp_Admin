import { supabase } from '@/lib/supabase';

export type MarketingEmailFields = {
  subject: string;
  heading: string;
  body: string;
  button_label: string;
  button_url: string;
  lower_body: string;
  banner_url: string;
  show_header: boolean;
  show_footer: boolean;
};

export const EMPTY_EMAIL: MarketingEmailFields = {
  subject: '',
  heading: '',
  body: '',
  button_label: '',
  button_url: '',
  lower_body: '',
  banner_url: '',
  show_header: true,
  show_footer: true,
};

const ALLOWED_BANNER_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

/** The server-side field names (camelCase for the renderer) */
export function toEdgeEmail(f: MarketingEmailFields) {
  return {
    subject: f.subject,
    heading: f.heading,
    body: f.body,
    buttonLabel: f.button_label,
    buttonUrl: f.button_url,
    lowerBody: f.lower_body,
    bannerUrl: f.banner_url,
    showHeader: f.show_header,
    showFooter: f.show_footer,
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
    lower_body: e.lowerBody || '',
    banner_url: e.bannerUrl || '',
    show_header: typeof e.showHeader === 'boolean' ? e.showHeader : true,
    show_footer: typeof e.showFooter === 'boolean' ? e.showFooter : true,
  };
}

/**
 * Wrap or unwrap the current selection with **bold** markers (Cmd/Ctrl+B).
 * Returns the next value and the selection range to restore.
 */
export function toggleBoldSelection(
  value: string,
  start: number,
  end: number
): { value: string; start: number; end: number } {
  const selected = value.slice(start, end);

  if (start === end) {
    const next = value.slice(0, start) + '****' + value.slice(end);
    return { value: next, start: start + 2, end: start + 2 };
  }

  if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
    const inner = selected.slice(2, -2);
    const next = value.slice(0, start) + inner + value.slice(end);
    return { value: next, start, end: start + inner.length };
  }

  if (
    start >= 2 &&
    end + 2 <= value.length &&
    value.slice(start - 2, start) === '**' &&
    value.slice(end, end + 2) === '**'
  ) {
    const next = value.slice(0, start - 2) + selected + value.slice(end + 2);
    return { value: next, start: start - 2, end: end - 2 };
  }

  const next = value.slice(0, start) + '**' + selected + '**' + value.slice(end);
  return { value: next, start, end: end + 4 };
}

/** Uploads a banner image to the public banners bucket and returns its public URL. */
export async function uploadMarketingBanner(file: File): Promise<string> {
  if (!ALLOWED_BANNER_TYPES.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, WebP or GIF image');
  }
  if (file.size > MAX_BANNER_BYTES) {
    throw new Error('The image must be smaller than 5MB');
  }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `marketing-email/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from('banners').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message || 'Could not upload the banner image');
  const { data: urlData } = supabase.storage.from('banners').getPublicUrl(data.path);
  if (!urlData?.publicUrl) throw new Error('Could not get the banner image URL');
  return urlData.publicUrl;
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
