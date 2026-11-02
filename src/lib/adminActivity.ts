import { supabase } from '@/lib/supabase';

// What admins do in the dashboard is recorded in `admin_activity` (through the admin_log_activity RPC) so a Super Admin
// can watch it live in Super Admin > Team. Logging never blocks or breaks the action it describes.

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Human label for the activity feed, e.g. "Cancelled a payout". Mutations without it are not recorded. */
      activity?: string;
    };
  }
}

export type ActivityKind = 'page_view' | 'action' | 'login' | 'logout';

const SESSION_TOKEN_KEY = 'admin_session_token';

export const getAdminSessionToken = (): string | null => localStorage.getItem(SESSION_TOKEN_KEY);
export const setAdminSessionToken = (token: string) => localStorage.setItem(SESSION_TOKEN_KEY, token);

const SENSITIVE_KEY = /pass(word)?|token|secret|otp|authorization|credential|cvv|api_?key|(^|_)(pin|nin|bvn|code)($|_)/i;

/** Keeps the log small and free of secrets: short primitive values only, at most 12 keys. */
export function summarizeDetails(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= 12) break;
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === 'string') {
      out[key] = value.length > 120 ? `${value.slice(0, 117)}...` : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = `${value.length} item${value.length === 1 ? '' : 's'}`;
    } else {
      continue;
    }
    count += 1;
  }
  return out;
}

async function send(
  kind: ActivityKind,
  action: string,
  args: { path?: string; resourceType?: string; resourceId?: string; details?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await supabase.rpc('admin_log_activity', {
      p_kind: kind,
      p_action: action,
      p_path: args.path ?? window.location.pathname,
      p_resource_type: args.resourceType ?? null,
      p_resource_id: args.resourceId ?? null,
      p_details: args.details ?? {},
    });
  } catch (err) {
    // Activity logging is best effort.
    console.warn('Could not record admin activity:', err);
  }
}

/** Records something an admin did, e.g. logAdminAction('Sent a push notification', { audience: 'all' }). */
export function logAdminAction(label: string, details?: unknown, resource?: { type?: string; id?: string }) {
  const summary = summarizeDetails(details);
  const resourceId =
    resource?.id ??
    (['id', 'userId', 'user_id', 'payoutId', 'vaultId'].map((k) => summary[k]).find((v) => typeof v === 'string') as
      | string
      | undefined);
  return send('action', label, { details: summary, resourceType: resource?.type, resourceId });
}

export const logPageView = (path: string) =>
  send('page_view', 'page.view', { path, details: { title: pageTitle(path) } });

export const logSignIn = () => send('login', 'auth.signed_in');

export const logSignOut = (reason?: string) => send('logout', 'auth.signed_out', { details: reason ? { reason } : {} });

const PAGE_TITLES: Array<[RegExp, string]> = [
  [/^\/welcome/, 'Welcome'],
  [/^\/dashboard/, 'Dashboard'],
  [/^\/users\/[^/]+\/transactions/, 'User transactions'],
  [/^\/users\/[^/]+\/events/, 'User events'],
  [/^\/users\/[^/]+\/completed-payouts/, 'User completed payouts'],
  [/^\/users\/[^/]+\/cancelled-payouts/, 'User cancelled payouts'],
  [/^\/users\/[^/]+/, 'User details'],
  [/^\/users/, 'Users'],
  [/^\/transactions/, 'Transactions'],
  [/^\/calendar/, 'Calendar'],
  [/^\/analytics/, 'Analytics'],
  [/^\/activity/, 'Activity'],
  [/^\/kyc-data/, 'KYC data'],
  [/^\/payout-events/, 'Payout events'],
  [/^\/process-payouts/, 'Process due payouts'],
  [/^\/payout-plans/, 'Payout plans'],
  [/^\/vaults\/[^/]+/, 'Vault details'],
  [/^\/vaults/, 'Vaults'],
  [/^\/super-admin/, 'Super Admin'],
  [/^\/banners/, 'Banners'],
  [/^\/app-versions/, 'App versions'],
  [/^\/marketing/, 'Marketing'],
  [/^\/notifications/, 'Notifications'],
  [/^\/blog/, 'Blog'],
  [/^\/audit-logs/, 'Audit logs'],
  [/^\/emergency-withdrawals/, 'Emergency withdrawals'],
  [/^\/settings/, 'Settings'],
];

export function pageTitle(path: string | null | undefined): string {
  if (!path) return 'Unknown page';
  return PAGE_TITLES.find(([re]) => re.test(path))?.[1] ?? path;
}

/** Plain-English line for a row of the feed. */
export function describeActivity(row: {
  kind: string;
  action: string;
  path?: string | null;
  details?: Record<string, unknown> | null;
}): string {
  const d = row.details ?? {};
  switch (row.kind) {
    case 'page_view':
      return `Opened ${typeof d.title === 'string' ? d.title : pageTitle(row.path)}`;
    case 'login':
      return 'Signed in';
    case 'logout':
      return d.reason === 'idle' ? 'Signed out after 5 minutes of inactivity' : 'Signed out';
    default:
      break;
  }
  switch (row.action) {
    case 'admin.forced_logout':
      return 'Signed a team member out everywhere';
    case 'admin.session_ended':
      return 'Ended a login session';
    case 'admin.role_removed':
      return `Removed the ${typeof d.role_name === 'string' ? d.role_name : ''} role`.replace('  ', ' ');
    case 'admin.suspended':
      return 'Suspended a team member';
    case 'admin.unsuspended':
      return 'Restored a suspended team member';
    default:
      return row.action;
  }
}
