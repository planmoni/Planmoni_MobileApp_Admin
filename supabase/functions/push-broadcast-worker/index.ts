import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  backoffMs,
  buildMessage,
  type BatchResult,
  chunk,
  classifyHttpFailure,
  classifyReceipt,
  classifyTicket,
  type ExpoMessage,
  type ExpoReceipt,
  type ExpoTicket,
  isValidExpoToken,
  jwtRole,
  type ReceiptResult,
} from './expo.ts';

// Drains the push queue (push_notification_recipients). Service role only.
// Called by the minute cron (push_queue_tick) and kicked by admin-push-notifications right after a send.
// Each run works for up to BUDGET_MS: it claims one paced batch per notification, sends it to Expo,
// writes the outcome back, sleeps until the next batch is due, and finally checks receipts.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BUDGET_MS = 100_000; // below the edge function wall clock limit
const RECEIPT_RESERVE_MS = 12_000; // keep this much time for the receipts pass
const MAX_ACTIVE_PER_RUN = 5;
const RECEIPT_REQUEST_SIZE = 300;

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function expoHeaders() {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (expoAccessToken) h.Authorization = `Bearer ${expoAccessToken}`;
  return h;
}

interface ExpoResponse {
  status: number;
  body: any;
  retryAfter: string | null;
}

/** POST to Expo, retrying 429/5xx/network errors a couple of times with backoff. */
async function expoPost(url: string, payload: unknown, deadline: number): Promise<ExpoResponse> {
  let last: ExpoResponse = { status: 0, body: null, retryAfter: null };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: expoHeaders(), body: JSON.stringify(payload) });
      const text = await res.text();
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = { raw: text.slice(0, 300) };
      }
      last = { status: res.status, body, retryAfter: res.headers.get('retry-after') };
    } catch (e) {
      last = { status: 0, body: { error: String(e) }, retryAfter: null };
    }
    if (last.status >= 200 && last.status < 300) return last;
    if (classifyHttpFailure(last.status, last.body) !== 'retry') return last;
    const wait = backoffMs(attempt, last.retryAfter);
    if (Date.now() + wait > deadline) return last;
    await sleep(wait);
  }
  return last;
}

interface ClaimedRecipient {
  id: string;
  user_id: string | null;
  token: string;
  first_name: string | null;
}

interface Claim {
  state: 'inactive' | 'wait' | 'done' | 'send';
  wait_ms?: number;
  notification?: { title: string; body: string; data?: unknown; personalize?: boolean };
  recipients?: ClaimedRecipient[];
}

async function sendSingles(
  recipients: ClaimedRecipient[],
  messages: ExpoMessage[],
  deadline: number,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for (const group of chunk(recipients.map((r, i) => ({ r, m: messages[i] })), 10)) {
    const part = await Promise.all(
      group.map(async ({ r, m }): Promise<BatchResult> => {
        const res = await expoPost(EXPO_SEND_URL, [m], deadline);
        if (res.status >= 200 && res.status < 300) {
          const tickets: ExpoTicket[] = Array.isArray(res.body?.data) ? res.body.data : [];
          return classifyTicket(r.id, tickets[0]);
        }
        const kind = classifyHttpFailure(res.status, res.body);
        const msg = `Expo HTTP ${res.status}`;
        return kind === 'fail' ? { id: r.id, ok: false, error: msg, deactivate: false } : { id: r.id, ok: null, error: msg };
      }),
    );
    results.push(...part);
  }
  return results;
}

async function sendBatch(claim: Claim, deadline: number): Promise<{ sent: number; failed: number; requeued: number }> {
  const recipients = claim.recipients ?? [];
  const notification = claim.notification!;
  const results: BatchResult[] = [];
  const sendable: ClaimedRecipient[] = [];
  const messages: ExpoMessage[] = [];

  for (const r of recipients) {
    if (!isValidExpoToken(r.token)) {
      results.push({ id: r.id, ok: false, error: 'Invalid Expo push token', deactivate: true });
      continue;
    }
    sendable.push(r);
    messages.push(buildMessage(notification, r));
  }

  if (sendable.length > 0) {
    const res = await expoPost(EXPO_SEND_URL, messages, deadline);
    if (res.status >= 200 && res.status < 300 && Array.isArray(res.body?.data)) {
      const tickets: ExpoTicket[] = res.body.data;
      sendable.forEach((r, i) => results.push(classifyTicket(r.id, tickets[i])));
    } else {
      const kind = classifyHttpFailure(res.status, res.body);
      if (kind === 'split') {
        results.push(...(await sendSingles(sendable, messages, deadline)));
      } else {
        const error = `Expo HTTP ${res.status}${res.body?.errors?.[0]?.message ? `: ${res.body.errors[0].message}` : ''}`.slice(0, 300);
        for (const r of sendable) {
          results.push(kind === 'fail' ? { id: r.id, ok: false, error, deactivate: false } : { id: r.id, ok: null, error });
        }
      }
    }
  }

  await completeWithRetry('push_complete_batch', results);
  return {
    sent: results.filter((r) => r.ok === true).length,
    failed: results.filter((r) => r.ok === false).length,
    requeued: results.filter((r) => r.ok === null).length,
  };
}

/** The write-back must not be lost: a lost completion would make the stuck-row sweeper resend the batch. */
async function completeWithRetry(fn: 'push_complete_batch' | 'push_complete_receipts', results: unknown[]) {
  if (results.length === 0) return;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await admin.rpc(fn, { p_results: results });
    if (!error) return;
    lastError = error;
    await sleep(500 * (attempt + 1));
  }
  console.error(`${fn} failed after retries`, lastError);
  throw new Error(`${fn} failed: ${JSON.stringify(lastError)}`);
}

async function activeNotificationIds(only?: string): Promise<string[]> {
  let q = admin
    .from('push_notifications')
    .select('id')
    .eq('status', 'sending')
    .eq('queue_enabled', true)
    .order('created_at', { ascending: true })
    .limit(MAX_ACTIVE_PER_RUN);
  if (only) q = q.eq('id', only);
  const { data, error } = await q;
  if (error) throw new Error(`list active: ${error.message}`);
  return (data ?? []).map((n: { id: string }) => n.id);
}

async function receiptsPass(deadline: number) {
  let checked = 0;
  while (Date.now() < deadline) {
    const { data, error } = await admin.rpc('push_claim_receipts', { p_limit: 1000 });
    if (error) throw new Error(`claim receipts: ${error.message}`);
    const rows: { id: string; ticket_id: string }[] = data ?? [];
    if (rows.length === 0) break;

    const results: ReceiptResult[] = [];
    for (const part of chunk(rows, RECEIPT_REQUEST_SIZE)) {
      const res = await expoPost(EXPO_RECEIPTS_URL, { ids: part.map((r) => r.ticket_id) }, deadline);
      const map: Record<string, ExpoReceipt> | undefined =
        res.status >= 200 && res.status < 300 ? res.body?.data : undefined;
      for (const r of part) results.push(classifyReceipt(r.id, map?.[r.ticket_id]));
    }
    await completeWithRetry('push_complete_receipts', results);
    checked += rows.length;
    if (rows.length < 1000) break;
  }
  return checked;
}

async function run(only?: string) {
  const started = Date.now();
  const deadline = started + BUDGET_MS;
  const totals = { batches: 0, sent: 0, failed: 0, requeued: 0, receipts_checked: 0 };

  while (Date.now() < deadline - RECEIPT_RESERVE_MS) {
    const ids = await activeNotificationIds(only);
    if (ids.length === 0) break;

    let didWork = false;
    let minWait = Infinity;
    for (const id of ids) {
      if (Date.now() >= deadline - RECEIPT_RESERVE_MS) break;
      const { data, error } = await admin.rpc('push_claim_next_batch', { p_notification_id: id });
      if (error) throw new Error(`claim: ${error.message}`);
      const claim = data as Claim;
      if (claim.state === 'send') {
        const r = await sendBatch(claim, deadline);
        totals.batches++;
        totals.sent += r.sent;
        totals.failed += r.failed;
        totals.requeued += r.requeued;
        didWork = true;
      } else if (claim.state === 'wait') {
        minWait = Math.min(minWait, claim.wait_ms ?? 1000);
      }
    }

    if (!didWork) {
      if (minWait === Infinity) break;
      // next batch is not due before this run ends: leave it for the next tick
      if (Date.now() + minWait > deadline - RECEIPT_RESERVE_MS) break;
      await sleep(minWait + 50);
    }
  }

  try {
    totals.receipts_checked = await receiptsPass(started + BUDGET_MS + RECEIPT_RESERVE_MS - 2_000);
  } catch (e) {
    console.error('receipts pass failed', e);
  }
  return { ...totals, elapsed_ms: Date.now() - started };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Only the database cron and the admin function (both with the service role key) may call this.
  if (jwtRole(req.headers.get('Authorization')) !== 'service_role') return json({ error: 'Forbidden' }, 403);

  let notificationId: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.notification_id === 'string') notificationId = body.notification_id;
  } catch {
    // no body is fine
  }

  try {
    return json({ success: true, ...(await run(notificationId)) });
  } catch (e) {
    console.error('worker error', e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
