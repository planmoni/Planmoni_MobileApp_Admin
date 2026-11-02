import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import {
  ACTIONABLE,
  type AttemptView,
  classifyStatusResponse,
  confirmationMatches,
  confirmationText,
  decide,
  type Decision,
  type DebitVerdict,
  inJobBoundaryWindow,
  isDuplicateResponse,
  isTransferSuccess,
  type Json,
  ledgerVerdict,
  type LedgerRow,
  manualReference,
  type ProviderLookup,
  toNipNarration,
} from './decision.ts';

/**
 * Admin "Process Due Payouts": inspect or process ONE due payout plan.
 *
 *   POST { action: 'inspect', plan_id }
 *   POST { action: 'process', plan_id, fingerprint, expected_kind, confirm }
 *
 * - The caller must be a signed-in admin holding payouts.process (or Super Admin). The check is made by the
 *   database (admin_due_payout_fingerprint / admin_begin_payout_process) with the admin's own token.
 * - Nothing is sent unless: the fingerprint the admin reviewed still matches the database, the decision made
 *   now is the one the admin reviewed (expected_kind), and `confirm` equals the text this function builds
 *   (PAY <amount> TO <last 4 of the account>).
 * - One run per plan at a time (payout_process_runs, unique while running). The run is always closed with
 *   admin_finish_payout_process, even on error.
 * - The rules live in decision.ts and are unit tested. Money is never sent unless decide() says
 *   resend / redebit_resend, and the wallet is only debited again when the ledger proves the earlier refund.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SAFEHAVEN_API_URL = Deno.env.get('SAFEHAVEN_API_URL') || 'https://api.safehavenmfb.com';
const SAFEHAVEN_CLIENT_ID = Deno.env.get('SAFEHAVEN_CLIENT_ID') || Deno.env.get('EXPO_PUBLIC_SAFEHAVEN_CLIENT_ID');
const SAFEHAVEN_CLIENT_ASSERTION = Deno.env.get('SAFEHAVEN_CLIENT_ASSERTION') ||
  Deno.env.get('EXPO_PUBLIC_SAFEHAVEN_CLIENT_ASSERTION');
// same debit account process-due-payouts uses; override with a secret instead of editing code
const DEBIT_ACCOUNT_NUMBER = Deno.env.get('SAFEHAVEN_DEBIT_ACCOUNT') || '0117753301';
const RESEND_POLL_ATTEMPTS = 2;
const RESEND_POLL_DELAY_MS = 1500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------------------------
// SafeHaven
// ---------------------------------------------------------------------------------------------

const tokenCache = new Map<string, string>();

async function safeHavenToken(userId: string): Promise<string | null> {
  const cached = tokenCache.get(userId);
  if (cached) return cached;
  if (!SAFEHAVEN_CLIENT_ID || !SAFEHAVEN_CLIENT_ASSERTION) return null;

  const { data: existing } = await service
    .from('safehaven_tokens')
    .select('access_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  const expiresAt = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
  if (existing?.access_token && expiresAt > Date.now() + 5 * 60 * 1000) {
    tokenCache.set(userId, existing.access_token);
    return existing.access_token;
  }

  const tokenRes = await fetch(`${SAFEHAVEN_API_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: SAFEHAVEN_CLIENT_ASSERTION,
      client_id: SAFEHAVEN_CLIENT_ID,
    }),
  });
  if (!tokenRes.ok) return null;
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return null;

  const newExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  if (existing) {
    await service
      .from('safehaven_tokens')
      .update({ access_token: tokenData.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } else {
    await service.from('safehaven_tokens').insert({
      user_id: userId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: newExpiresAt,
      ibs_client_id: SAFEHAVEN_CLIENT_ID,
      client_id: SAFEHAVEN_CLIENT_ID,
    });
  }
  tokenCache.set(userId, tokenData.access_token);
  return tokenData.access_token;
}

function safeHavenHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    accept: 'application/json',
    ClientID: SAFEHAVEN_CLIENT_ID || '',
    Authorization: `Bearer ${accessToken}`,
  };
}

async function lookupReference(accessToken: string, paymentReference: string): Promise<ProviderLookup> {
  let response: Response;
  try {
    response = await fetch(`${SAFEHAVEN_API_URL}/transfers/status`, {
      method: 'POST',
      headers: safeHavenHeaders(accessToken),
      body: JSON.stringify({ paymentReference }),
    });
  } catch (err) {
    return {
      provider_status: 'lookup_failed',
      provider_message: err instanceof Error ? err.message : String(err),
      provider_http_status: null,
      provider_record_pending: false,
    };
  }
  const raw = (await response.json().catch(() => ({}))) as Json;
  return classifyStatusResponse(response.status, raw);
}

async function lookupFor(userId: string, reference: string | null): Promise<ProviderLookup> {
  if (!reference) {
    return { provider_status: 'missing_reference', provider_message: null, provider_http_status: null, provider_record_pending: false };
  }
  const token = await safeHavenToken(userId);
  if (!token) {
    return { provider_status: 'lookup_failed', provider_message: 'SafeHaven token unavailable', provider_http_status: null, provider_record_pending: false };
  }
  return lookupReference(token, reference);
}

async function pollReference(accessToken: string, reference: string): Promise<ProviderLookup | null> {
  let last: ProviderLookup | null = null;
  for (let i = 0; i < RESEND_POLL_ATTEMPTS; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, RESEND_POLL_DELAY_MS));
    last = await lookupReference(accessToken, reference);
    if (last.provider_status === 'Completed' || last.provider_status === 'Failed' || last.provider_status === 'Reversed') return last;
  }
  return last;
}

async function nameEnquiry(accessToken: string, bankCode: string, accountNumber: string) {
  const response = await fetch(`${SAFEHAVEN_API_URL}/transfers/name-enquiry`, {
    method: 'POST',
    headers: safeHavenHeaders(accessToken),
    body: JSON.stringify({ bankCode, accountNumber }),
  });
  const data = (await response.json().catch(() => ({}))) as Json;
  const inner = (data.data && typeof data.data === 'object' ? data.data : {}) as Json;
  if (!response.ok || data.statusCode !== 200 || data.responseCode !== '00') {
    const message = data.message || inner.responseMessage || data.error || 'Name enquiry failed';
    throw new Error(`SafeHaven name enquiry failed: ${message}`);
  }
  const sessionId = (inner.sessionId || data.sessionId) as string | undefined;
  if (!sessionId) throw new Error('Name enquiry did not return sessionId');
  return { sessionId, accountName: (inner.accountName as string | undefined) ?? null };
}

type TransferResult = {
  id: string | null;
  reference: string;
  sessionId: string | null;
  status: string;
  rawResponse: Json;
};

class PostError extends Error {
  constructor(message: string, public raw: Json | null, public httpError: boolean) {
    super(message);
  }
}

async function postTransfer(
  accessToken: string,
  args: { amount: number; accountNumber: string; bankCode: string; nameEnquiryReference: string; narration: string; paymentReference: string },
): Promise<TransferResult> {
  let response: Response;
  try {
    response = await fetch(`${SAFEHAVEN_API_URL}/transfers`, {
      method: 'POST',
      headers: safeHavenHeaders(accessToken),
      body: JSON.stringify({
        saveBeneficiary: true,
        amount: args.amount,
        beneficiaryAccountNumber: args.accountNumber,
        beneficiaryBankCode: args.bankCode,
        debitAccountNumber: DEBIT_ACCOUNT_NUMBER,
        nameEnquiryReference: args.nameEnquiryReference,
        narration: args.narration,
        paymentReference: args.paymentReference,
      }),
    });
  } catch (err) {
    // The request may or may not have reached SafeHaven: unknown, never assume "not sent".
    throw new PostError(`Request to SafeHaven failed: ${err instanceof Error ? err.message : String(err)}`, null, false);
  }
  const raw = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    const message = raw.message || raw.error || 'Unknown transfer error';
    throw new PostError(`SafeHaven transfer failed: ${message}`, raw, true);
  }
  const data = (raw.data && typeof raw.data === 'object' ? raw.data : raw) as Json;
  return {
    id: ((data._id || data.id) as string | undefined) ?? null,
    reference: (data.paymentReference as string | undefined) || args.paymentReference,
    sessionId: ((data.sessionId || data.session_id) as string | undefined) ?? null,
    status: (data.status as string | undefined) || 'Pending',
    rawResponse: raw,
  };
}

// ---------------------------------------------------------------------------------------------
// reading the plan
// ---------------------------------------------------------------------------------------------

type Plan = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  payout_amount: number | string;
  completed_payouts: number;
  duration: number;
  next_payout_date: string | null;
  payout_account_id: string | null;
  bank_account_id: string | null;
};

type Attempt = {
  id: string;
  status: string;
  installment_index: number | null;
  amount: number | string | null;
  transfer_reference: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  payout_account_id: string | null;
  safehaven_transfer_id: string | null;
  session_id: string | null;
  metadata: Json | null;
};

type Account = {
  id: string;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  bank_code: string | null;
  safehaven_bank_code: string | null;
};

const ATTEMPT_COLUMNS =
  'id, status, installment_index, amount, transfer_reference, error_message, created_at, updated_at, payout_account_id, safehaven_transfer_id, session_id, metadata';

async function loadPlan(planId: string): Promise<Plan> {
  const { data, error } = await service
    .from('payout_plans')
    .select('id, user_id, name, status, payout_amount, completed_payouts, duration, next_payout_date, payout_account_id, bank_account_id')
    .eq('id', planId)
    .maybeSingle();
  if (error) throw new HttpError(500, `Could not read the plan: ${error.message}`);
  if (!data) throw new HttpError(404, 'Payout plan not found');
  return data as Plan;
}

async function loadAttempt(plan: Plan): Promise<Attempt | null> {
  const { data, error } = await service
    .from('automated_payouts')
    .select(ATTEMPT_COLUMNS)
    .eq('payout_plan_id', plan.id)
    .eq('installment_index', plan.completed_payouts)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError(500, `Could not read the payout: ${error.message}`);
  return (data as Attempt | null) ?? null;
}

async function loadAccount(plan: Plan, attempt: Attempt | null): Promise<Account | null> {
  const id = plan.payout_account_id || attempt?.payout_account_id;
  if (!id) return null;
  const { data } = await service
    .from('payout_accounts')
    .select('id, account_name, account_number, bank_name, bank_code, safehaven_bank_code')
    .eq('id', id)
    .maybeSingle();
  return (data as Account | null) ?? null;
}

async function resolveAmount(plan: Plan, attempt: Attempt | null): Promise<number> {
  const md = (attempt?.metadata ?? {}) as Json;
  const debited = Number(md.wallet_debited_amount);
  if (attempt && Number.isFinite(debited) && debited > 0) return debited;
  const fromRow = Number(attempt?.amount);
  if (attempt && Number.isFinite(fromRow) && fromRow > 0) return fromRow;
  const { data } = await service.rpc('resolve_payout_installment_amount', {
    p_plan_id: plan.id,
    p_installment_index: plan.completed_payouts,
  });
  const resolved = Number(data);
  if (Number.isFinite(resolved) && resolved > 0) return resolved;
  return Number(plan.payout_amount);
}

/** Ledger rows linked to this installment, plus the transfer / refund rows in the window around the debit. */
async function ledgerFor(plan: Plan, attempt: Attempt, amount: number) {
  const md = (attempt.metadata ?? {}) as Json;
  const flagged = md.wallet_debited === true;
  const when = (typeof md.wallet_debited_at === 'string' && md.wallet_debited_at) || attempt.created_at || null;

  const { data: exactRows, error: exactError } = await service
    .from('wallet_ledger')
    .select('id, operation, balance_delta, locked_balance_delta')
    .eq('user_id', plan.user_id)
    .or(`source_ref.eq.${attempt.id},metadata->>automated_payout_id.eq.${attempt.id}`)
    .order('recorded_at', { ascending: true })
    .limit(20);

  let windowRows: LedgerRow[] = [];
  let windowError: string | null = null;
  const at = when ? new Date(when).getTime() : NaN;
  if (Number.isFinite(at) && Number.isFinite(amount)) {
    const { data, error } = await service
      .from('wallet_ledger')
      .select('id, operation, balance_delta, locked_balance_delta')
      .eq('user_id', plan.user_id)
      .in('operation', ['transfer_funds', 'refund_payout_wallet_debit'])
      .gte('recorded_at', new Date(at - 2 * 60 * 1000).toISOString())
      .lte('recorded_at', new Date(at + 10 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: true })
      .limit(30);
    windowRows = (data ?? []) as LedgerRow[];
    windowError = error?.message ?? null;
  }

  const seen = new Set<number>();
  const rows = [...((exactRows ?? []) as LedgerRow[]), ...windowRows].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  const verdict = ledgerVerdict(amount, flagged, rows);
  // a failed ledger read must never look like "no debit"; AMBIGUOUS stops every resend
  const lookupError = exactError?.message ?? windowError;
  return {
    verdict: (lookupError ? 'AMBIGUOUS' : verdict.debit_verdict) as DebitVerdict,
    debit_rows: verdict.debits,
    refund_rows: verdict.refunds,
    lookup_error: lookupError ?? null,
  };
}

type Snapshot = {
  plan: Plan;
  attempt: Attempt | null;
  account: Account | null;
  amount: number;
  provider: ProviderLookup | null;
  ledger: Awaited<ReturnType<typeof ledgerFor>> | null;
  decision: Decision;
  confirm_text: string | null;
  actionable: boolean;
};

async function snapshot(planId: string): Promise<Snapshot> {
  const plan = await loadPlan(planId);
  const attempt = await loadAttempt(plan);
  const account = await loadAccount(plan, attempt);
  const amount = await resolveAmount(plan, attempt);

  let provider: ProviderLookup | null = null;
  let ledger: Snapshot['ledger'] = null;
  if (attempt && attempt.status !== 'completed') {
    ledger = await ledgerFor(plan, attempt, amount);
    // Ask SafeHaven only where the answer can change what is done.
    const md = (attempt.metadata ?? {}) as Json;
    // (a claimed row that was never sent has nothing at SafeHaven to look up)
    const neverSent = attempt.status !== 'failed' && md.safehaven_transfer_initiated !== true;
    if (!neverSent && attempt.transfer_reference) {
      provider = await lookupFor(plan.user_id, attempt.transfer_reference);
    }
  }

  const view: AttemptView | null = attempt
    ? { status: attempt.status, transfer_reference: attempt.transfer_reference, amount: attempt.amount, metadata: (attempt.metadata ?? {}) as Json }
    : null;
  let decision = decide(view, provider, ledger?.verdict ?? null);

  // a due plan must still be a plan this tool may act on
  if (plan.status !== 'active') {
    decision = { kind: 'manual_review', reason: `The plan is ${plan.status}, not active.` };
  } else if (plan.completed_payouts >= plan.duration) {
    decision = { kind: 'already_paid', reason: 'The plan has no installments left.' };
  } else if (!account?.account_number) {
    decision = { kind: 'manual_review', reason: 'The plan has no payout bank account.' };
  }

  const actionable = ACTIONABLE.has(decision.kind) && Boolean(account?.account_number) && amount > 0;
  const confirm_text = actionable ? confirmationText(amount, account!.account_number, decision.kind) : null;
  return { plan, attempt, account, amount, provider, ledger, decision, confirm_text, actionable };
}

function describeEffects(kind: Decision['kind']): string[] {
  switch (kind) {
    case 'job_ready':
      return [
        'Runs the same payout job the 5 minute scheduler runs (process-due-payouts). It cannot be limited to one plan, so any other plan that is due and ready is paid in the same run.',
        'The wallet is debited once for this installment, then one transfer is sent from the corporate account.',
      ];
    case 'mark_paid':
      return [
        'SafeHaven already confirmed this transfer. No new transfer is sent.',
        'The installment is recorded as completed and the plan moves to its next payout date. The wallet is debited only if that never happened.',
      ];
    case 'resend':
      return [
        'The wallet debit is already held and the ledger proves it, so the wallet is NOT debited again.',
        'One new transfer is sent from the corporate account under a new reference.',
      ];
    case 'redebit_resend':
      return [
        'The earlier debit was refunded and the ledger proves it, so the wallet IS debited again.',
        'One new transfer is sent from the corporate account under a new reference.',
      ];
    default:
      return [];
  }
}

function snapshotView(s: Snapshot, fingerprint: string | null) {
  const md = (s.attempt?.metadata ?? {}) as Json;
  return {
    plan: {
      id: s.plan.id,
      name: s.plan.name,
      status: s.plan.status,
      installment: s.plan.completed_payouts + 1,
      duration: s.plan.duration,
      next_payout_date: s.plan.next_payout_date,
    },
    amount: s.amount,
    account: s.account
      ? { bank_name: s.account.bank_name, account_name: s.account.account_name, account_number: s.account.account_number }
      : null,
    attempt: s.attempt
      ? {
        id: s.attempt.id,
        status: s.attempt.status,
        reference: s.attempt.transfer_reference,
        error: s.attempt.error_message,
        updated_at: s.attempt.updated_at,
        wallet_debited: md.wallet_debited === true,
        wallet_refund_applied: md.wallet_refund_applied === true,
        safehaven_initiated: md.safehaven_transfer_initiated === true,
        manual_hold: md.manual_hold === true,
        manual_resend: md.manual_resend === true,
      }
      : null,
    provider: s.provider ? { status: s.provider.provider_status, message: s.provider.provider_message } : null,
    ledger: s.ledger ? { verdict: s.ledger.verdict, debit_rows: s.ledger.debit_rows, refund_rows: s.ledger.refund_rows } : null,
    decision: s.decision,
    actionable: s.actionable,
    confirm_text: s.confirm_text,
    effects: s.actionable ? describeEffects(s.decision.kind) : [],
    fingerprint,
  };
}

// ---------------------------------------------------------------------------------------------
// acting
// ---------------------------------------------------------------------------------------------

type Outcome = { outcome: string; message: string; details?: Json };

async function finishPaid(attemptId: string, externalReference: string | null, note: string): Promise<Outcome | null> {
  const { data, error } = await service.rpc('complete_manual_payout_installment', {
    p_automated_payout_id: attemptId,
    p_external_reference: externalReference,
    p_notes: note,
    p_unpause_plan: true,
  });
  if (error) return { outcome: 'error', message: `Could not record the payout as completed: ${error.message}` };
  const result = data as { success?: boolean; error?: string } | null;
  if (result && result.success === false) {
    return { outcome: 'error', message: result.error || 'complete_manual_payout_installment failed', details: { complete: data as Json } };
  }
  return null;
}

async function runPayoutJob(plan: Plan): Promise<Outcome> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/process-due-payouts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch { /* keep text */ }
  const summary = (parsed as { result?: Json } | null)?.result ?? null;

  // what happened to THIS plan, read back from the database
  const after = await loadPlan(plan.id);
  const attempt = await loadAttempt(after);
  const advanced = after.completed_payouts > plan.completed_payouts;
  const details: Json = {
    http_status: response.status,
    job_summary: summary,
    plan_completed_payouts: after.completed_payouts,
    payout_status: attempt?.status ?? null,
    payout_reference: attempt?.transfer_reference ?? null,
  };
  if (!response.ok) return { outcome: 'error', message: `The payout job answered HTTP ${response.status}.`, details };
  if (advanced || attempt?.status === 'completed') {
    return { outcome: 'paid', message: 'The payout job paid this installment.', details };
  }
  if (attempt && (attempt.status === 'pending' || attempt.status === 'processing')) {
    return { outcome: 'job_started', message: 'The payout job started the transfer. It is waiting for SafeHaven to confirm.', details };
  }
  if (attempt?.status === 'failed') {
    return { outcome: 'error', message: `The payout job tried and the payout failed${attempt.error_message ? `: ${attempt.error_message}` : ''}.`, details };
  }
  return { outcome: 'skipped', message: 'The payout job did not start this installment. Inspect it again for the reason.', details };
}

/** The manual resend: the proven procedure, with the old provider identifiers detached before the POST. */
async function manualResend(
  s: Snapshot,
  adminId: string,
  mode: 'resend' | 'redebit_resend',
): Promise<Outcome> {
  const plan = s.plan;
  let ap = s.attempt!;
  const account = s.account!;
  const userId = plan.user_id;

  const accessToken = await safeHavenToken(userId);
  if (!accessToken) return { outcome: 'error', message: 'SafeHaven token unavailable. Nothing was changed.' };

  // bank details and name enquiry come first: a failure here leaves the wallet and the row untouched
  let bankCode = account.safehaven_bank_code;
  if (!bankCode && account.bank_name) {
    const { data: mapping } = await service
      .from('bank_comparison')
      .select('safehaven_code')
      .ilike('bank_name', account.bank_name)
      .limit(1)
      .maybeSingle();
    if (mapping?.safehaven_code) {
      bankCode = mapping.safehaven_code as string;
      await service.from('payout_accounts').update({ safehaven_bank_code: bankCode, updated_at: new Date().toISOString() }).eq('id', account.id);
    }
  }
  if (!account.account_name || !account.account_number || !account.bank_name) {
    return { outcome: 'error', message: 'The payout account is incomplete. Nothing was changed.' };
  }
  if (!bankCode) return { outcome: 'error', message: `No SafeHaven bank code for ${account.bank_name}. Nothing was changed.` };

  let enquiry: { sessionId: string; accountName: string | null };
  try {
    enquiry = await nameEnquiry(accessToken, bankCode, account.account_number);
  } catch (err) {
    return { outcome: 'error', message: `${err instanceof Error ? err.message : String(err)}. Nothing was changed.` };
  }

  let md = (ap.metadata ?? {}) as Json;
  let debitedAgain = false;

  if (mode === 'redebit_resend') {
    if (inJobBoundaryWindow(new Date())) {
      return { outcome: 'skipped', message: 'The payout job is about to run. Try again in about 15 seconds. Nothing was changed.' };
    }
    if (md.manual_hold === true) {
      const { error } = await service
        .from('automated_payouts')
        .update({ metadata: { ...md, manual_hold: false }, updated_at: new Date().toISOString() })
        .eq('id', ap.id)
        .eq('status', 'failed')
        .eq('updated_at', ap.updated_at);
      if (error) return { outcome: 'error', message: `Could not clear the manual hold: ${error.message}. Nothing was sent.` };
    }
    const { data: claimRaw, error: claimError } = await service.rpc('claim_payout_installment', { p_plan_id: plan.id, p_payment_reference: null });
    if (claimError) return { outcome: 'error', message: `The wallet could not be debited again: ${claimError.message}. Nothing was sent.` };
    const claim = claimRaw as { success?: boolean; error?: string; claimed?: boolean } | null;
    if (!claim?.success || !claim.claimed) {
      return { outcome: 'error', message: `${claim?.error || 'The installment was not claimed'}. Nothing was sent.` };
    }
    const { data: reloaded, error: reloadError } = await service.from('automated_payouts').select(ATTEMPT_COLUMNS).eq('id', ap.id).maybeSingle();
    if (reloadError || !reloaded) {
      return { outcome: 'needs_dashboard_check', message: 'The wallet was debited again but the payout could not be reloaded. Nothing was sent. Check the payout in Payout Events.' };
    }
    ap = reloaded as Attempt;
    md = (ap.metadata ?? {}) as Json;
    if (md.wallet_debited !== true || md.wallet_refund_applied === true) {
      return { outcome: 'needs_dashboard_check', message: 'The debit did not leave a fresh wallet debit. Nothing was sent. Check the payout in Payout Events.' };
    }
    debitedAgain = true;
  }

  const oldReference = ap.transfer_reference;
  const amount = Number(md.wallet_debited_amount ?? ap.amount);
  if (!oldReference || !Number.isFinite(amount) || amount <= 0) {
    return { outcome: 'error', message: 'The payout has no usable reference or amount. Nothing was sent.', details: { debited_again: debitedAgain } };
  }
  if (!debitedAgain && Math.abs(amount - s.amount) > 0.001) {
    return { outcome: 'error', message: 'The debited amount changed during the review. Nothing was sent.' };
  }

  const installmentIndex = ap.installment_index ?? plan.completed_payouts;
  const newReference = manualReference(plan.id, installmentIndex, Date.now());
  const nowIso = new Date().toISOString();

  // Stage the new reference BEFORE the POST, with the old provider identifiers detached, so that
  //  - the webhook can match the new transfer,
  //  - a late webhook for the OLD transfer can no longer find this payout and refund the wallet,
  //  - the payout job leaves the row alone (initiated = true).
  const staged: Json = {
    ...md,
    manual_resend: true,
    manual_resend_at: nowIso,
    manual_resend_by: adminId,
    manual_resend_source: 'admin-process-payouts',
    previous_transfer_reference: oldReference,
    previous_safehaven_transfer_id: ap.safehaven_transfer_id,
    previous_session_id: ap.session_id,
    previous_provider_lookup: s.provider ? { status: s.provider.provider_status, message: s.provider.provider_message } : null,
    previous_response: md.response ?? null,
    previous_transfer_status: md.transfer_status ?? null,
    payment_reference: newReference,
    manual_resend_amount: amount,
    manual_resend_name_enquiry_account_name: enquiry.accountName,
    safehaven_transfer_initiated: true,
  };
  const { data: stagedRows, error: stageError } = await service
    .from('automated_payouts')
    .update({
      status: 'processing',
      transfer_reference: newReference,
      payment_reference: newReference,
      safehaven_transfer_id: null,
      session_id: null,
      metadata: staged,
      error_message: null,
      updated_at: nowIso,
    })
    .eq('id', ap.id)
    .eq('transfer_reference', oldReference)
    .eq('updated_at', ap.updated_at)
    .select('id');
  if (stageError) {
    return { outcome: debitedAgain ? 'needs_dashboard_check' : 'error', message: `Could not stage the new reference: ${stageError.message}. Nothing was sent.`, details: { debited_again: debitedAgain } };
  }
  if (!stagedRows || stagedRows.length !== 1) {
    return {
      outcome: debitedAgain ? 'needs_dashboard_check' : 'skipped',
      message: 'The payout changed while it was being prepared. Nothing was sent.',
      details: { debited_again: debitedAgain },
    };
  }

  // the payout transaction follows the new reference too
  const { data: tx } = await service
    .from('transactions')
    .select('id, metadata, status')
    .eq('type', 'payout')
    .eq('metadata->>automated_payout_id', ap.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tx?.id) {
    const txMd = { ...((tx.metadata as Json | null) ?? {}) } as Json;
    const previousTxId = txMd.safehaven_transfer_id ?? null;
    delete txMd.safehaven_transfer_id;
    delete txMd.safehaven_transfer_session_id;
    const { error: txError } = await service
      .from('transactions')
      .update({
        reference: newReference,
        status: tx.status === 'failed' ? 'pending' : tx.status,
        metadata: { ...txMd, manual_resend_reference: newReference, previous_transfer_reference: oldReference, previous_safehaven_transfer_id: previousTxId },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id);
    if (txError) {
      // nothing was sent yet: put the payout row back exactly as it was
      await service
        .from('automated_payouts')
        .update({
          transfer_reference: oldReference,
          payment_reference: (md.payment_reference as string | undefined) ?? oldReference,
          safehaven_transfer_id: ap.safehaven_transfer_id,
          session_id: ap.session_id,
          metadata: md,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ap.id)
        .eq('transfer_reference', newReference);
      return { outcome: debitedAgain ? 'needs_dashboard_check' : 'error', message: `Could not stage the transaction: ${txError.message}. Nothing was sent.`, details: { debited_again: debitedAgain } };
    }
  }

  const base: Json = { old_reference: oldReference, new_reference: newReference, debited_again: debitedAgain };

  let transfer: TransferResult;
  try {
    transfer = await postTransfer(accessToken, {
      amount,
      accountNumber: account.account_number,
      bankCode,
      nameEnquiryReference: enquiry.sessionId,
      narration: toNipNarration(`Automated payout: ${plan.name}`),
      paymentReference: newReference,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const raw = err instanceof PostError ? err.raw : null;
    await service.rpc('mark_payout_safehaven_initiated', {
      p_automated_payout_id: ap.id,
      p_metadata: { provider: 'safehaven', transfer_code: newReference, transfer_status: 'PostRejected', response: raw, manual_resend_error: message },
    });
    const duplicate = raw && isDuplicateResponse(raw);
    if (duplicate) {
      const polled = await pollReference(accessToken, newReference);
      if (polled?.provider_status === 'Completed') {
        const failure = await finishPaid(ap.id, newReference, 'Paid from admin Process Due Payouts after SafeHaven confirmed the transfer');
        if (failure) return { ...failure, details: { ...base, ...(failure.details ?? {}) } };
        return { outcome: 'paid', message: 'SafeHaven confirmed the transfer. The installment is completed.', details: base };
      }
      return { outcome: 'resent_pending', message: `SafeHaven reported a duplicate reference; its status is ${polled?.provider_status ?? 'unknown'}. The webhook will finish it.`, details: base };
    }
    if (err instanceof PostError && !err.httpError) {
      // unknown whether SafeHaven received it
      return {
        outcome: 'needs_dashboard_check',
        message: `${message}. The transfer may have been sent under ${newReference}. Check the SafeHaven dashboard before anything else.`,
        details: base,
      };
    }
    return {
      outcome: 'error',
      message: `${message}. The wallet debit is held and nothing was sent. Resolve it from Payout Events (Retry or Refund).`,
      details: { ...base, provider_response: raw },
    };
  }

  await service.rpc('mark_payout_safehaven_initiated', {
    p_automated_payout_id: ap.id,
    p_metadata: {
      provider: 'safehaven',
      transfer_code: transfer.reference,
      transfer_status: transfer.status,
      response: transfer.rawResponse,
      manual_resend_reference: newReference,
    },
  });
  await service
    .from('automated_payouts')
    .update({
      transfer_code: transfer.reference,
      payment_reference: transfer.reference,
      safehaven_transfer_id: transfer.id,
      session_id: transfer.sessionId,
      transferred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', ap.id);
  if (tx?.id) {
    const { data: txNow } = await service.from('transactions').select('metadata').eq('id', tx.id).maybeSingle();
    await service
      .from('transactions')
      .update({
        metadata: {
          ...((txNow?.metadata as Json | null) ?? {}),
          provider: 'safehaven',
          transfer_code: transfer.reference,
          transfer_status: transfer.status,
          safehaven_transfer_id: transfer.id,
          safehaven_transfer_session_id: transfer.sessionId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id);
  }

  let finalStatus = transfer.status;
  let completed = isTransferSuccess(transfer.rawResponse, transfer.status);
  let failed = false;
  if (!completed) {
    if (isDuplicateResponse(transfer.rawResponse) || transfer.status === 'Pending' || transfer.status === 'Processing') {
      const polled = await pollReference(accessToken, newReference);
      if (polled && polled.provider_status !== 'lookup_failed' && polled.provider_status !== 'NotFound') {
        finalStatus = polled.provider_status;
      }
    }
    completed = finalStatus === 'Completed' || finalStatus === 'Success';
    failed = finalStatus === 'Failed' || finalStatus === 'Reversed';
  }
  const summary: Json = { ...base, provider_status: finalStatus, session_id: transfer.sessionId };

  if (completed) {
    const failure = await finishPaid(ap.id, newReference, 'Paid from admin Process Due Payouts after SafeHaven confirmed the transfer');
    if (failure) return { ...failure, details: { ...summary, ...(failure.details ?? {}) } };
    return { outcome: 'paid', message: 'SafeHaven confirmed the transfer. The installment is completed.', details: summary };
  }
  if (failed) {
    const { data: failData, error: failError } = await service.rpc('fail_payout_installment', {
      p_automated_payout_id: ap.id,
      p_reason: `Manual resend ${finalStatus}`,
      p_provider_metadata: { provider: 'safehaven', transfer_code: newReference, transfer_status: finalStatus, response: transfer.rawResponse, failed_via: 'admin-process-payouts' },
    });
    if (failError) {
      return { outcome: 'needs_dashboard_check', message: `The transfer is ${finalStatus} but the refund failed: ${failError.message}. Check the payout in Payout Events.`, details: summary };
    }
    return { outcome: 'failed_refunded', message: `SafeHaven reports the new transfer ${finalStatus}. The wallet debit was refunded.`, details: { ...summary, fail: failData as Json } };
  }
  return {
    outcome: 'resent_pending',
    message: 'SafeHaven accepted the new transfer but it is not Completed yet. The webhook finishes it.',
    details: summary,
  };
}

// ---------------------------------------------------------------------------------------------
// request handling
// ---------------------------------------------------------------------------------------------

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return respond({ success: false, error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return respond({ success: false, error: 'Sign in required' }, 401);

  // the admin's own client: every permission check runs in the database as that admin
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData?.user) return respond({ success: false, error: 'Sign in required' }, 401);
  const adminId = userData.user.id;

  let body: Json;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Json;
  } catch {
    return respond({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const action = body.action;
  const planId = body.plan_id;
  if (action !== 'inspect' && action !== 'process') return respond({ success: false, error: 'Unknown action' }, 400);
  if (typeof planId !== 'string' || !UUID_RE.test(planId)) return respond({ success: false, error: 'plan_id must be a UUID' }, 400);

  // permission + due check + fingerprint, in one database call made as the admin
  const { data: fpData, error: fpError } = await userClient.rpc('admin_due_payout_fingerprint', { p_plan_id: planId });
  if (fpError) {
    const needs2fa = /two-factor/i.test(fpError.message);
    const denied = /permission denied/i.test(fpError.message);
    if (needs2fa) return respond({ success: false, error: fpError.message, code: 'mfa_required' }, 403);
    return respond({ success: false, error: denied ? 'You are not allowed to process payouts.' : fpError.message }, denied ? 403 : 500);
  }
  const fp = fpData as { due: boolean; fingerprint: string | null };
  if (!fp?.due) {
    return respond({ success: false, error: 'This plan is no longer due. Refresh the list.', code: 'not_due' }, 409);
  }

  if (action === 'inspect') {
    const snap = await snapshot(planId);
    // the fingerprint is read again after the lookups so it describes what the admin is shown
    const { data: fp2 } = await userClient.rpc('admin_due_payout_fingerprint', { p_plan_id: planId });
    return respond({ success: true, ...snapshotView(snap, (fp2 as { fingerprint?: string } | null)?.fingerprint ?? fp.fingerprint) });
  }

  // ----- process -----
  const fingerprint = body.fingerprint;
  const expectedKind = body.expected_kind;
  if (typeof fingerprint !== 'string' || !fingerprint || fingerprint.length > 100) {
    return respond({ success: false, error: 'fingerprint is required' }, 400);
  }
  if (typeof expectedKind !== 'string') return respond({ success: false, error: 'expected_kind is required' }, 400);

  const before = await snapshot(planId);
  if (!before.actionable || !before.confirm_text) {
    return respond({ success: false, error: `Nothing can be processed here: ${before.decision.reason}`, code: 'not_actionable', decision: before.decision }, 409);
  }
  if (before.decision.kind !== expectedKind) {
    return respond({ success: false, error: 'The situation changed since you reviewed it. Review it again.', code: 'changed', decision: before.decision }, 409);
  }
  if (!confirmationMatches(body.confirm, before.confirm_text)) {
    return respond({ success: false, error: 'The confirmation text does not match.', code: 'bad_confirmation' }, 400);
  }

  // fingerprint check + per-plan lock + audit, in the database, as the admin
  const { data: begin, error: beginError } = await userClient.rpc('admin_begin_payout_process', {
    p_plan_id: planId,
    p_fingerprint: fingerprint,
  });
  if (beginError) {
    const conflict = /changed|already|no longer due/i.test(beginError.message);
    return respond({ success: false, error: beginError.message, code: conflict ? 'conflict' : 'error' }, conflict ? 409 : 403);
  }
  const runId = (begin as { run_id: string }).run_id;

  let result: Outcome;
  try {
    // decide again now that the lock is held: only the exact decision the admin confirmed may run
    const now = await snapshot(planId);
    if (!now.actionable || now.decision.kind !== expectedKind || now.confirm_text !== before.confirm_text) {
      result = { outcome: 'skipped', message: `The situation changed while locking: ${now.decision.reason} Nothing was sent.` };
    } else if (now.decision.kind === 'job_ready') {
      result = await runPayoutJob(now.plan);
    } else if (now.decision.kind === 'mark_paid') {
      const failure = await finishPaid(
        now.attempt!.id,
        now.attempt!.transfer_reference,
        `Marked paid from admin Process Due Payouts after SafeHaven confirmed Completed (admin ${adminId})`,
      );
      result = failure ?? { outcome: 'already_paid_marked', message: 'SafeHaven confirmed the transfer. The installment is now recorded as completed.' };
    } else {
      result = await manualResend(now, adminId, now.decision.kind as 'resend' | 'redebit_resend');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('admin-process-payouts failed', planId, message);
    result = {
      outcome: 'needs_dashboard_check',
      message: `Something went wrong part way: ${message}. Check the payout in Payout Events and the SafeHaven dashboard before trying again.`,
    };
  }

  // always close the run, whatever happened above
  await service.rpc('admin_finish_payout_process', {
    p_run_id: runId,
    p_outcome: result.outcome,
    p_result: { message: result.message, ...(result.details ?? {}), expected_kind: expectedKind },
  });

  const ok = !['error', 'needs_dashboard_check', 'skipped'].includes(result.outcome);
  return respond({ success: ok, ...result, run_id: runId }, 200);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    return await handle(req);
  } catch (err) {
    if (err instanceof HttpError) return respond({ success: false, error: err.message }, err.status);
    console.error('admin-process-payouts unhandled', err);
    return respond({ success: false, error: 'Unexpected error' }, 500);
  }
});
