/** Planmoni email brand tokens (light mode). */

export const EMAIL = {
  primary: '#1E3A8A',
  iconNavy: '#203B8B',
  text: '#1E293B',
  textSecondary: '#64748B',
  /** Outer + card: white — no sky/slate wash behind the message */
  pageBg: '#FFFFFF',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  /** Neutral chip (not sky blue) */
  chip: '#F8FAFC',
  accent: '#C3F769',
  accentText: '#4E6622',
  /** Amounts / figures use navy or near-black — never green */
  figure: '#1E3A8A',
  warning: '#F59E0B',
  error: '#EF4444',
  font:
    "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  maxWidth: 520,
} as const;

/** Full-width designed header (replaces wordmark logo in emails). */
export const EMAIL_HEADER_URL =
  'https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/Payout-vault-images./email-header.png';

/** Full-width designed footer (partners + download row). */
export const EMAIL_FOOTER_URL =
  'https://sso.planmoni.com/storage/v1/object/public/Payout-vault-images./footer-email.png';

/** @deprecated Prefer EMAIL_HEADER_URL for email chrome */
export const LOGO_URL = EMAIL_HEADER_URL;

export const APP_STORE_BADGE_URL =
  'https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/documents/app-apple.png';

export const PLAY_STORE_BADGE_URL =
  'https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/documents/app-google.png';

export const SITE_URL = 'https://planmoni.com';
export const SUPPORT_EMAIL = 'support@planmoni.com';
