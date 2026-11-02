// Pure helpers for the push broadcast worker: message building and how Expo's answers are classified.
// No network, no database, so it can be unit tested (expo_test.ts).

export interface ExpoMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  priority: 'high';
  data?: Record<string, unknown>;
}

export interface ExpoTicket {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; [k: string]: unknown };
}

export interface ExpoReceipt {
  status?: 'ok' | 'error';
  message?: string;
  details?: { error?: string; [k: string]: unknown };
}

/** One entry of the array handed to push_complete_batch. ok = null means "not sent, put it back in the queue". */
export type BatchResult =
  | { id: string; ok: true; ticket_id: string }
  | { id: string; ok: false; error: string; deactivate: boolean }
  | { id: string; ok: null; error: string };

export type ReceiptResult =
  | { id: string; status: 'ok' }
  | { id: string; status: 'error'; error: string; deactivate: boolean }
  | { id: string; status: 'retry' };

export function truncate(str: unknown, max: number): string {
  if (typeof str !== 'string') return '';
  return str.length > max ? str.substring(0, max) : str;
}

export function cleanData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = truncate(value, 100);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else if (Array.isArray(value)) out[key] = value.map((v) => (typeof v === 'string' ? truncate(v, 100) : v));
    else if (value && typeof value === 'object') out[key] = cleanData(value);
  }
  return out;
}

export function isValidExpoToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token) || /^[a-zA-Z0-9_-]{22}$/.test(token);
}

/** "Hello Ada, <message>" within Expo's 200 character body budget; "there" when the name is missing. */
export function personalizeBody(message: string, firstName: string | null | undefined, personalize: boolean): string {
  if (!personalize) return truncate(message, 200);
  const name = firstName && firstName.trim() ? firstName.trim() : 'there';
  return truncate(`Hello ${name}, ${truncate(message, 170)}`, 200);
}

export function buildMessage(
  notification: { title: string; body: string; data?: unknown; personalize?: boolean },
  recipient: { token: string; first_name?: string | null },
): ExpoMessage {
  const msg: ExpoMessage = {
    to: recipient.token,
    sound: 'default',
    title: truncate(notification.title, 100),
    body: personalizeBody(notification.body, recipient.first_name, !!notification.personalize),
    priority: 'high',
  };
  const data = cleanData(notification.data);
  if (Object.keys(data).length > 0) msg.data = data;
  return msg;
}

const DEAD_TOKEN_ERRORS = new Set(['DeviceNotRegistered']);
// the device may well be fine next time
const TRANSIENT_ERRORS = new Set(['MessageRateExceeded', 'ExpoError']);

export function classifyTicket(id: string, ticket: ExpoTicket | undefined): BatchResult {
  if (!ticket) return { id, ok: null, error: 'Expo returned no ticket for this message' };
  if (ticket.status === 'ok' && ticket.id) return { id, ok: true, ticket_id: ticket.id };
  if (ticket.status === 'ok') return { id, ok: null, error: 'Expo accepted the message without a ticket id' };

  const code = ticket.details?.error ?? '';
  const message = ticket.message || code || 'Expo rejected the message';
  if (TRANSIENT_ERRORS.has(code)) return { id, ok: null, error: truncate(message, 300) };
  return { id, ok: false, error: truncate(message, 300), deactivate: DEAD_TOKEN_ERRORS.has(code) };
}

/**
 * What to do when the whole HTTP request failed.
 *   retry  Expo is busy or broken (429, 5xx, network): put everything back in the queue
 *   split  tokens from different Expo projects in one request (PUSH_TOO_MANY_EXPERIENCE_IDS): send them one by one
 *   fail   the request itself is wrong (other 4xx): retrying will not help
 */
export function classifyHttpFailure(status: number, body: unknown): 'retry' | 'split' | 'fail' {
  if (status === 429 || status >= 500 || status === 0) return 'retry';
  const text = JSON.stringify(body ?? '');
  if (text.includes('PUSH_TOO_MANY_EXPERIENCE_IDS')) return 'split';
  return 'fail';
}

export function classifyReceipt(id: string, receipt: ExpoReceipt | undefined): ReceiptResult {
  // not available (yet): try again on a later pass
  if (!receipt || !receipt.status) return { id, status: 'retry' };
  if (receipt.status === 'ok') return { id, status: 'ok' };
  const code = receipt.details?.error ?? '';
  return {
    id,
    status: 'error',
    error: truncate(receipt.message || code || 'Delivery failed', 300),
    deactivate: DEAD_TOKEN_ERRORS.has(code),
  };
}

/** Wait before retrying a throttled request: Retry-After when Expo sends it, else exponential, capped. */
export function backoffMs(attempt: number, retryAfter: string | null): number {
  const asSeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(asSeconds) && asSeconds > 0) return Math.min(asSeconds * 1000, 20_000);
  return Math.min(1000 * 2 ** attempt, 20_000);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The role claim of a JWT, without verifying it (verify_jwt does that before the function runs). */
export function jwtRole(authorization: string | null): string | null {
  if (!authorization) return null;
  const token = authorization.replace(/^Bearer\s+/i, '');
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const role = JSON.parse(json)?.role;
    return typeof role === 'string' ? role : null;
  } catch {
    return null;
  }
}
