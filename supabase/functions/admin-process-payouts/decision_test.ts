import {
  type AttemptView,
  classifyStatusResponse,
  confirmationMatches,
  confirmationText,
  inJobBoundaryWindow,
  ACTIONABLE,
  decide,
  isDuplicateResponse,
  isTransferSuccess,
  ledgerVerdict,
  manualReference,
  type ProviderLookup,
  storedPostLooksAccepted,
  toNipNarration,
} from './decision.ts';

function assertEquals<T>(actual: T, expected: T, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}\n  actual:   ${a}\n  expected: ${b}`);
}

const NOT_FOUND = classifyStatusResponse(404, { message: 'Unable to locate record', status: 'Completed' });
const pending = (status = 'Pending'): ProviderLookup => classifyStatusResponse(200, { data: { status } });
const lookupFailed: ProviderLookup = {
  provider_status: 'lookup_failed',
  provider_message: 'timeout',
  provider_http_status: null,
  provider_record_pending: false,
};

const attempt = (over: Partial<AttemptView> & { meta?: Record<string, unknown> } = {}): AttemptView => ({
  status: over.status ?? 'processing',
  transfer_reference: over.transfer_reference === undefined ? 'AUTO_x_i0_1' : over.transfer_reference,
  amount: over.amount ?? 1000,
  metadata: {
    wallet_debited: true,
    wallet_refund_applied: false,
    safehaven_transfer_initiated: true,
    ...(over.meta ?? {}),
  },
});

// ----- status classification -----

Deno.test('status: unable to locate wins over any placeholder status', () => {
  assertEquals(NOT_FOUND.provider_status, 'NotFound');
  assertEquals(NOT_FOUND.provider_record_pending, false);
});
Deno.test('status: Completed / Success', () => {
  assertEquals(classifyStatusResponse(200, { data: { status: 'Completed' } }).provider_status, 'Completed');
  assertEquals(classifyStatusResponse(200, { data: { status: 'Success' } }).provider_status, 'Completed');
});
Deno.test('status: Failed and Reversed are final, not pending', () => {
  for (const s of ['Failed', 'Reversed']) {
    const r = classifyStatusResponse(200, { data: { status: s } });
    assertEquals(r.provider_status, s);
    assertEquals(r.provider_record_pending, false);
  }
});
Deno.test('status: Pending / Processing / empty are a real pending record', () => {
  assertEquals(pending('Pending').provider_record_pending, true);
  assertEquals(pending('Processing').provider_record_pending, true);
  const empty = classifyStatusResponse(200, {});
  assertEquals(empty.provider_status, 'Pending');
  assertEquals(empty.provider_record_pending, true);
});

// ----- POST replies -----

Deno.test('post: duplicate reply is code 94 or "duplicate" with 400', () => {
  assertEquals(isDuplicateResponse({ statusCode: 400, responseCode: '94' }), true);
  assertEquals(isDuplicateResponse({ statusCode: 400, message: 'Duplicate transaction' }), true);
  assertEquals(isDuplicateResponse({ statusCode: 400, responseCode: '51' }), false);
  assertEquals(isDuplicateResponse({ statusCode: 200, responseCode: '94' }), false);
});
Deno.test('post: success needs 200 + 00 + final status', () => {
  assertEquals(isTransferSuccess({ statusCode: 200, responseCode: '00', data: { status: 'Completed' } }, 'Pending'), true);
  assertEquals(isTransferSuccess({ statusCode: 200, responseCode: '00', data: { status: 'Pending' } }, 'Pending'), false);
  assertEquals(isTransferSuccess({ statusCode: 200, responseCode: '91', data: { status: 'Completed' } }, 'Pending'), false);
});

Deno.test('stored post: accepted only with 00 and a session id or Completed', () => {
  const ok = storedPostLooksAccepted({ response: { responseCode: '00', data: { sessionId: 'abc', status: 'Pending' } } });
  assertEquals(ok.accepted, true);
  assertEquals(storedPostLooksAccepted({ response: { responseCode: '00', data: { status: 'Pending' } } }).accepted, false);
  assertEquals(storedPostLooksAccepted({ response: { responseCode: '51', data: { sessionId: 'abc' } } }).accepted, false);
  assertEquals(storedPostLooksAccepted({}).accepted, false);
  assertEquals(
    storedPostLooksAccepted({ response: { responseCode: '00', data: { status: 'Completed' } } }).accepted,
    true,
  );
});

// ----- ledger verdict -----

const debitRow = (id: number, amt = 1000) => ({ id, operation: 'transfer_funds', balance_delta: -amt, locked_balance_delta: -amt });
const refundRow = (id: number, amt = 1000) => ({
  id,
  operation: 'refund_payout_wallet_debit',
  balance_delta: amt,
  locked_balance_delta: amt,
});

Deno.test('ledger: no rows and no flag', () => assertEquals(ledgerVerdict(1000, false, []).debit_verdict, 'NO_DEBIT_FOUND'));
Deno.test('ledger: flag only', () => assertEquals(ledgerVerdict(1000, true, []).debit_verdict, 'FLAG_ONLY'));
Deno.test('ledger: one debit', () => assertEquals(ledgerVerdict(1000, true, [debitRow(1)]).debit_verdict, 'DEBITED_NOT_REFUNDED'));
Deno.test('ledger: debit then refund', () =>
  assertEquals(ledgerVerdict(1000, true, [debitRow(1), refundRow(2)]).debit_verdict, 'DEBITED_THEN_REFUNDED'));
Deno.test('ledger: two debits are ambiguous', () =>
  assertEquals(ledgerVerdict(1000, true, [debitRow(1), debitRow(2)]).debit_verdict, 'AMBIGUOUS'));
Deno.test('ledger: a debit of another amount does not count', () =>
  assertEquals(ledgerVerdict(1000, true, [debitRow(1, 500)]).debit_verdict, 'FLAG_ONLY'));
Deno.test('ledger: balance-only change does not count', () =>
  assertEquals(
    ledgerVerdict(1000, false, [{ id: 1, operation: 'transfer_funds', balance_delta: -1000, locked_balance_delta: 0 }]).debit_verdict,
    'NO_DEBIT_FOUND',
  ));
Deno.test('ledger: invalid amount is ambiguous', () => assertEquals(ledgerVerdict(NaN, true, []).debit_verdict, 'AMBIGUOUS'));

// ----- decide -----

Deno.test('decide: no attempt -> job_ready', () => assertEquals(decide(null, null, null).kind, 'job_ready'));
Deno.test('decide: completed -> already_paid', () =>
  assertEquals(decide(attempt({ status: 'completed' }), null, null).kind, 'already_paid'));
Deno.test('decide: unknown status -> manual_review', () =>
  assertEquals(decide(attempt({ status: 'weird' }), null, null).kind, 'manual_review'));

Deno.test('decide: debited but never sent -> job_ready (job sends it)', () => {
  const a = attempt({ meta: { safehaven_transfer_initiated: false } });
  assertEquals(decide(a, null, null).kind, 'job_ready');
});
Deno.test('decide: processing without debit -> job_ready', () => {
  assertEquals(decide(attempt({ meta: { wallet_debited: false, safehaven_transfer_initiated: false } }), null, null).kind, 'job_ready');
});

Deno.test('decide: provider Completed -> mark_paid whatever the wallet flags say', () => {
  const done = classifyStatusResponse(200, { data: { status: 'Completed' } });
  assertEquals(decide(attempt(), done, 'DEBITED_NOT_REFUNDED').kind, 'mark_paid');
  assertEquals(decide(attempt({ status: 'failed', meta: { wallet_refund_applied: true } }), done, 'DEBITED_THEN_REFUNDED').kind, 'mark_paid');
});
Deno.test('decide: real pending record -> wait_pending, never resend', () => {
  assertEquals(decide(attempt(), pending(), 'DEBITED_NOT_REFUNDED').kind, 'wait_pending');
  assertEquals(decide(attempt(), pending('Processing'), 'DEBITED_NOT_REFUNDED').kind, 'wait_pending');
});
Deno.test('decide: lookup failure -> retry_later, never resend', () => {
  assertEquals(decide(attempt(), lookupFailed, 'DEBITED_NOT_REFUNDED').kind, 'retry_later');
});
Deno.test('decide: no reference -> manual_review', () => {
  assertEquals(decide(attempt({ transfer_reference: null }), NOT_FOUND, 'DEBITED_NOT_REFUNDED').kind, 'manual_review');
});

Deno.test('decide: NotFound + debit held + ledger proves it -> resend', () => {
  assertEquals(decide(attempt(), NOT_FOUND, 'DEBITED_NOT_REFUNDED').kind, 'resend');
});
Deno.test('decide: Reversed + debit held -> resend', () => {
  const rev = classifyStatusResponse(200, { data: { status: 'Reversed' } });
  assertEquals(decide(attempt({ status: 'failed' }), rev, 'DEBITED_NOT_REFUNDED').kind, 'resend');
});
Deno.test('decide: NotFound but the original POST was accepted -> needs_dashboard_check', () => {
  const a = attempt({ meta: { response: { responseCode: '00', data: { sessionId: 'S1' } } } });
  assertEquals(decide(a, NOT_FOUND, 'DEBITED_NOT_REFUNDED').kind, 'needs_dashboard_check');
});
Deno.test('decide: Failed provider status is trusted even if the stored POST looked accepted', () => {
  const failedLookup = classifyStatusResponse(200, { data: { status: 'Failed' } });
  const a = attempt({ meta: { response: { responseCode: '00', data: { sessionId: 'S1' } } } });
  assertEquals(decide(a, failedLookup, 'DEBITED_NOT_REFUNDED').kind, 'resend');
});
Deno.test('decide: debit held but ledger cannot prove it -> manual_review, never resend', () => {
  for (const v of ['NO_DEBIT_FOUND', 'FLAG_ONLY', 'AMBIGUOUS', 'DEBITED_THEN_REFUNDED', null] as const) {
    assertEquals(decide(attempt(), NOT_FOUND, v).kind, 'manual_review', String(v));
  }
});
Deno.test('decide: manual resend already made -> manual_review, never a second resend', () => {
  const a = attempt({ transfer_reference: 'MANUAL_p_i0_1', meta: { manual_resend: true } });
  assertEquals(decide(a, NOT_FOUND, 'DEBITED_NOT_REFUNDED').kind, 'manual_review');
});

Deno.test('decide: refund flag on a processing row -> manual_review', () => {
  const a = attempt({ meta: { wallet_refund_applied: true } });
  assertEquals(decide(a, NOT_FOUND, 'DEBITED_THEN_REFUNDED').kind, 'manual_review');
});
Deno.test('decide: failed + refunded + ledger proof + no hold -> job_ready (engine pays it)', () => {
  const a = attempt({ status: 'failed', meta: { wallet_refund_applied: true } });
  assertEquals(decide(a, NOT_FOUND, 'DEBITED_THEN_REFUNDED').kind, 'job_ready');
});
Deno.test('decide: failed + refunded + ledger proof + manual hold -> redebit_resend', () => {
  const a = attempt({ status: 'failed', meta: { wallet_refund_applied: true, manual_hold: true } });
  assertEquals(decide(a, NOT_FOUND, 'DEBITED_THEN_REFUNDED').kind, 'redebit_resend');
});
Deno.test('decide: failed + refunded but ledger does not prove the refund -> manual_review', () => {
  const a = attempt({ status: 'failed', meta: { wallet_refund_applied: true, manual_hold: true } });
  for (const v of ['DEBITED_NOT_REFUNDED', 'NO_DEBIT_FOUND', 'FLAG_ONLY', 'AMBIGUOUS', null] as const) {
    assertEquals(decide(a, NOT_FOUND, v).kind, 'manual_review', String(v));
  }
});
Deno.test('decide: failed without debit or refund -> manual_review (claim would refuse it too)', () => {
  const a = attempt({ status: 'failed', meta: { wallet_debited: false } });
  assertEquals(decide(a, NOT_FOUND, 'NO_DEBIT_FOUND').kind, 'manual_review');
});

Deno.test('decide: nothing resends without a provider lookup', () => {
  assertEquals(decide(attempt(), null, 'DEBITED_NOT_REFUNDED').kind, 'retry_later');
});

// ----- confirmation and narration -----

Deno.test('confirmation text binds amount and account', () => {
  assertEquals(confirmationText(1959.25, '9028003216'), 'PAY 1959.25 TO 3216');
  assertEquals(confirmationText(1700, '0123456789'), 'PAY 1700.00 TO 6789');
});
Deno.test('confirmation match ignores case and spacing only', () => {
  const expected = 'PAY 1959.25 TO 3216';
  assertEquals(confirmationMatches('pay 1959.25 to 3216', expected), true);
  assertEquals(confirmationMatches('  PAY   1959.25 TO 3216 ', expected), true);
  assertEquals(confirmationMatches('PAY 1959.26 TO 3216', expected), false);
  assertEquals(confirmationMatches('PAY 1959.25 TO 3217', expected), false);
  assertEquals(confirmationMatches(undefined, expected), false);
  assertEquals(confirmationMatches('PAY_LISTED_DUE', expected), false);
});
Deno.test('narration: ampersand and unsafe characters are removed, length capped', () => {
  assertEquals(toNipNarration('Automated payout: Internet & Data'), 'Automated payout: Internet and Data');
  assertEquals(toNipNarration('<b>"x"</b>'), 'b x /b');
  assertEquals(toNipNarration('   '), 'Payout');
  assertEquals(toNipNarration('a'.repeat(300)).length, 100);
});
Deno.test('manual reference shape', () => {
  assertEquals(manualReference('P', 0, 5), 'MANUAL_P_i0_5');
});

Deno.test('confirmation text: mark paid uses its own verb', () => {
  assertEquals(confirmationText(1959.25, '9028003216', 'mark_paid'), 'MARK PAID 1959.25 TO 3216');
});
Deno.test('only job_ready, mark_paid, resend, redebit_resend are actionable', () => {
  assertEquals([...ACTIONABLE].sort(), ['job_ready', 'mark_paid', 'redebit_resend', 'resend']);
});
Deno.test('job boundary window is 10s after to 10s before each 5 minute mark', () => {
  assertEquals(inJobBoundaryWindow(new Date('2026-11-01T10:05:03Z')), true);
  assertEquals(inJobBoundaryWindow(new Date('2026-11-01T10:09:55Z')), true);
  assertEquals(inJobBoundaryWindow(new Date('2026-11-01T10:07:30Z')), false);
  assertEquals(inJobBoundaryWindow(new Date('2026-11-01T10:05:10Z')), false);
});
Deno.test('decide: failed with no debit and no reference is manual_review', () => {
  const a = attempt({ status: 'failed', transfer_reference: null, meta: { wallet_debited: false } });
  assertEquals(decide(a, null, null).kind, 'manual_review');
});
