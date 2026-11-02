// Pure decision logic for admin-process-payouts. No network, no database, no Deno APIs, so every rule
// can be unit tested with fixtures (decision_test.ts) before any money moves.
//
// The rules are the ones the temporary pay-listed-due-payouts function proved on live payouts, with two
// differences that make them stricter:
//   1. A resend only happens when decide() says "resend" or "redebit_resend". The old function computed the
//      same answer for its report but sent anyway; here it is the gate.
//   2. A NotFound lookup is never treated as proof of "not sent" when the stored reply of the original POST
//      was accepted (responseCode 00 with a sessionId): that is "needs_dashboard_check".

export type Json = Record<string, unknown>;

export type ProviderLookup = {
  provider_status: string; // Completed | Failed | Reversed | Pending | Processing | NotFound | lookup_failed | missing_reference
  provider_message: string | null;
  provider_http_status: number | null;
  /** true only when SafeHaven returned a real record in a non-final state */
  provider_record_pending: boolean;
};

export type LedgerRow = {
  id: number;
  operation: string;
  balance_delta: number | string;
  locked_balance_delta: number | string;
};

export type DebitVerdict =
  | 'NO_DEBIT_FOUND'
  | 'FLAG_ONLY'
  | 'DEBITED_NOT_REFUNDED'
  | 'DEBITED_THEN_REFUNDED'
  | 'AMBIGUOUS';

export type DecisionKind =
  | 'already_paid' // the installment is completed; nothing to do
  | 'job_ready' // nothing is held or in flight: the payout job (process-due-payouts) pays it
  | 'mark_paid' // SafeHaven says Completed: record it (complete_manual_payout_installment)
  | 'wait_pending' // SafeHaven has a real pending record: wait
  | 'resend' // wallet debit is held, SafeHaven has no live transfer: send one new transfer
  | 'redebit_resend' // debit was refunded and the ledger proves it: debit again, send one new transfer
  | 'needs_dashboard_check' // SafeHaven may have paid; do not resend
  | 'retry_later' // SafeHaven lookup failed
  | 'manual_review'; // something does not add up; a person decides

export type Decision = { kind: DecisionKind; reason: string };

export type AttemptView = {
  status: string; // automated_payouts.status
  transfer_reference: string | null;
  amount: number | string | null;
  metadata: Json;
};

// ---------------------------------------------------------------------------------------------
// SafeHaven /transfers/status
// ---------------------------------------------------------------------------------------------

/**
 * "Unable to locate record" means SafeHaven has NO record for the reference, whatever HTTP status or
 * placeholder status it echoes back, so it always wins -> NotFound.
 */
export function classifyStatusResponse(httpStatus: number, raw: Json): ProviderLookup {
  const inner = (raw?.data && typeof raw.data === 'object' ? raw.data : {}) as Json;
  const status = (inner?.status || raw?.status || null) as string | null;
  const message = String(raw?.message || inner?.responseMessage || '');
  const notFound = message.toLowerCase().includes('unable to locate');
  const completed = !notFound && (status === 'Completed' || status === 'Success');
  const failed = !notFound && (status === 'Failed' || status === 'Reversed');
  const providerStatus = notFound
    ? 'NotFound'
    : completed
    ? 'Completed'
    : failed
    ? (status as string)
    : (status || 'Pending');
  return {
    provider_status: providerStatus,
    provider_message: message || null,
    provider_http_status: httpStatus,
    provider_record_pending: !notFound && !completed && !failed,
  };
}

/** SafeHaven POST /transfers answered with a duplicate-reference error (code 94). */
export function isDuplicateResponse(raw: Json): boolean {
  const data = (raw.data && typeof raw.data === 'object' ? raw.data : {}) as Json;
  const code = String(raw.responseCode ?? data.responseCode ?? '');
  const message = String(raw.message || data.responseMessage || '').toLowerCase();
  return raw.statusCode === 400 && (code === '94' || message.includes('duplicate'));
}

/** SafeHaven POST /transfers answered 200 / 00 with a final success status. */
export function isTransferSuccess(raw: Json, fallbackStatus: string): boolean {
  const data = (raw.data && typeof raw.data === 'object' ? raw.data : {}) as Json;
  const dataStatus = (data.status as string | undefined) || fallbackStatus;
  return raw.statusCode === 200 && raw.responseCode === '00' && (dataStatus === 'Completed' || dataStatus === 'Success');
}

/**
 * The stored reply of the ORIGINAL POST. If SafeHaven accepted it (responseCode "00" with a sessionId or a
 * Completed status) the money may really have left even though /transfers/status cannot find the reference.
 */
export function storedPostLooksAccepted(metadata: Json): { accepted: boolean; summary: Json } {
  const response = (metadata.response && typeof metadata.response === 'object' ? metadata.response : {}) as Json;
  const data = (response.data && typeof response.data === 'object' ? response.data : {}) as Json;
  const responseCode = String(response.responseCode ?? data.responseCode ?? '');
  const status = String(data.status ?? response.status ?? metadata.transfer_status ?? '');
  const sessionId = String(data.sessionId ?? data.session_id ?? '');
  const accepted = responseCode === '00' && (sessionId.length > 0 || status === 'Completed' || status === 'Success');
  return {
    accepted,
    summary: {
      stored_response_code: responseCode || null,
      stored_status: status || null,
      stored_session_id: sessionId || null,
      stored_transfer_status: (metadata.transfer_status as string | undefined) ?? null,
      safehaven_transfer_initiated: metadata.safehaven_transfer_initiated === true,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// wallet ledger proof
// ---------------------------------------------------------------------------------------------

export function amountsMatch(left: unknown, right: number): boolean {
  const value = Number(left);
  return Number.isFinite(value) && Math.abs(value - right) < 0.02;
}

/**
 * Proof of a wallet debit comes from wallet_ledger, not from automated_payouts.metadata.
 * transfer_funds writes operation=transfer_funds and lowers both balance and locked_balance.
 * A refund writes operation=refund_payout_wallet_debit and raises both.
 * `rows` are the deduplicated ledger rows linked to this installment (by source_ref / metadata) plus the
 * transfer_funds / refund rows in the time window around the debit.
 */
export function ledgerVerdict(
  amount: number,
  flaggedDebited: boolean,
  rows: LedgerRow[],
): { debit_verdict: DebitVerdict; debits: number; refunds: number } {
  const debits = rows.filter((row) =>
    row.operation === 'transfer_funds' &&
    amountsMatch(row.balance_delta, -amount) &&
    amountsMatch(row.locked_balance_delta, -amount)
  ).length;
  const refunds = rows.filter((row) =>
    row.operation === 'refund_payout_wallet_debit' &&
    amountsMatch(row.balance_delta, amount) &&
    amountsMatch(row.locked_balance_delta, amount)
  ).length;

  let debit_verdict: DebitVerdict = 'NO_DEBIT_FOUND';
  if (!Number.isFinite(amount)) debit_verdict = 'AMBIGUOUS';
  else if (debits > 1) debit_verdict = 'AMBIGUOUS';
  else if (debits === 1 && refunds > 0) debit_verdict = 'DEBITED_THEN_REFUNDED';
  else if (debits === 1) debit_verdict = 'DEBITED_NOT_REFUNDED';
  else if (flaggedDebited) debit_verdict = 'FLAG_ONLY';
  return { debit_verdict, debits, refunds };
}

// ---------------------------------------------------------------------------------------------
// the decision
// ---------------------------------------------------------------------------------------------

/**
 * What may be done for the current installment of a due plan. `attempt` is null when the job has not started
 * the installment. `provider` is the lookup of attempt.transfer_reference (null when none was made).
 * `ledger` is the verdict for that attempt (null when none was computed).
 */
export function decide(
  attempt: AttemptView | null,
  provider: ProviderLookup | null,
  ledger: DebitVerdict | null,
): Decision {
  if (!attempt) {
    return { kind: 'job_ready', reason: 'The payout job has not started this installment.' };
  }
  const md = attempt.metadata ?? {};
  const debited = md.wallet_debited === true;
  const refunded = md.wallet_refund_applied === true;
  const initiated = md.safehaven_transfer_initiated === true;
  const manualHold = md.manual_hold === true;
  const alreadyResent = md.manual_resend === true;
  const status = attempt.status;

  if (status === 'completed') {
    return { kind: 'already_paid', reason: 'This installment is already completed.' };
  }
  if (!['pending', 'processing', 'retrying', 'failed'].includes(status)) {
    return { kind: 'manual_review', reason: `Unexpected payout status "${status}".` };
  }

  // Claimed but never sent, and nothing is held: the job's own path handles it.
  if (status !== 'failed' && debited && !refunded && !initiated) {
    return {
      kind: 'job_ready',
      reason: 'The wallet was debited but the transfer was never sent. The payout job sends it.',
    };
  }
  if (!debited && status !== 'failed') {
    return { kind: 'job_ready', reason: 'No wallet debit was recorded. The payout job claims and pays it.' };
  }

  if (refunded && status !== 'failed') {
    return {
      kind: 'manual_review',
      reason: 'The refund flag is set but the payout is not failed. Resolve it with the Payout Events actions.',
    };
  }
  if (alreadyResent && !refunded) {
    return {
      kind: 'manual_review',
      reason: `A manual resend was already made (${attempt.transfer_reference}). Check SafeHaven before any further action.`,
    };
  }
  if (!attempt.transfer_reference?.trim()) {
    return { kind: 'manual_review', reason: 'The payout has no transfer reference to check.' };
  }
  if (!provider) {
    return { kind: 'retry_later', reason: 'SafeHaven was not asked about this transfer yet.' };
  }

  // What SafeHaven says about the reference on the row always comes first.
  if (provider.provider_status === 'lookup_failed' || provider.provider_status === 'missing_reference') {
    return { kind: 'retry_later', reason: `SafeHaven lookup failed: ${provider.provider_message ?? 'no detail'}.` };
  }
  if (provider.provider_status === 'Completed') {
    return { kind: 'mark_paid', reason: 'SafeHaven confirms the transfer is Completed.' };
  }
  if (provider.provider_record_pending) {
    return { kind: 'wait_pending', reason: 'SafeHaven has a real pending record for this transfer. Wait for it.' };
  }

  // NotFound / Failed / Reversed
  if (provider.provider_status === 'NotFound') {
    const stored = storedPostLooksAccepted(md);
    if (stored.accepted) {
      return {
        kind: 'needs_dashboard_check',
        reason:
          'The original transfer request was accepted (response code 00 with a session id) but the status API cannot find it. Check the SafeHaven dashboard before anything else.',
      };
    }
  }

  const providerReason = provider.provider_status === 'NotFound'
    ? 'SafeHaven cannot locate the original transfer'
    : `SafeHaven says ${provider.provider_status}`;

  if (refunded) {
    // failed + refunded. Without a hold the hourly retry (and the payout job) pays it the engine's own way.
    if (ledger !== 'DEBITED_THEN_REFUNDED') {
      return {
        kind: 'manual_review',
        reason: `${providerReason}, but the wallet ledger verdict is ${ledger ?? 'unknown'}, not DEBITED_THEN_REFUNDED. The wallet will not be debited again.`,
      };
    }
    if (!manualHold) {
      return { kind: 'job_ready', reason: `${providerReason}. The debit was refunded; the payout job pays it again.` };
    }
    return {
      kind: 'redebit_resend',
      reason: `${providerReason}. The debit was refunded and the ledger proves it; the wallet is debited again and one new transfer is sent.`,
    };
  }

  // debit still held
  if (ledger !== 'DEBITED_NOT_REFUNDED') {
    return {
      kind: 'manual_review',
      reason: `${providerReason}, but the wallet ledger verdict is ${ledger ?? 'unknown'}, not DEBITED_NOT_REFUNDED. Nothing is resent.`,
    };
  }
  return {
    kind: 'resend',
    reason: `${providerReason}. The wallet debit is held; one new transfer is sent without debiting again.`,
  };
}

// ---------------------------------------------------------------------------------------------
// confirmation text and narration
// ---------------------------------------------------------------------------------------------

/**
 * The exact text an admin must type: bound to the amount and the destination account.
 * "MARK PAID" when the installment is only recorded as paid (SafeHaven already confirmed it); "PAY" when money moves.
 */
export function confirmationText(amount: number, accountNumber: string | null, kind: DecisionKind = 'resend'): string {
  const last4 = (accountNumber ?? '').replace(/\D/g, '').slice(-4);
  const verb = kind === 'mark_paid' ? 'MARK PAID' : 'PAY';
  return `${verb} ${Number(amount).toFixed(2)} TO ${last4}`;
}

/** Decisions an admin may act on. Everything else is information only. */
export const ACTIONABLE: ReadonlySet<DecisionKind> = new Set<DecisionKind>([
  'job_ready',
  'mark_paid',
  'resend',
  'redebit_resend',
]);

/** Re-debit sends must not start right at a 5 minute job boundary (the payout job could claim the same row). */
export function inJobBoundaryWindow(now: Date): boolean {
  const secs = (now.getUTCMinutes() % 5) * 60 + now.getUTCSeconds();
  return secs < 10 || secs >= 290;
}

/** Only the confirmation text typed with the same letters (spaces trimmed, case ignored) is accepted. */
export function confirmationMatches(typed: unknown, expected: string): boolean {
  return typeof typed === 'string' && typed.trim().replace(/\s+/g, ' ').toUpperCase() === expected.toUpperCase();
}

const NIP_NARRATION_MAX = 100;

/** NIBSS NIP narrations are XML: an unescaped "&" makes the switch return code 30 and reverse the transfer. */
export function toNipNarration(value: string): string {
  const cleaned = value
    .replace(/&/g, ' and ')
    .replace(/[<>"'`]/g, ' ')
    .replace(/[^\w\s.,:/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const text = cleaned || 'Payout';
  return text.length <= NIP_NARRATION_MAX ? text : text.slice(0, NIP_NARRATION_MAX).trim();
}

/** Manual reference, same shape the proven flow used. */
export function manualReference(planId: string, installmentIndex: number, nowMs: number): string {
  return `MANUAL_${planId}_i${installmentIndex}_${nowMs}`;
}
