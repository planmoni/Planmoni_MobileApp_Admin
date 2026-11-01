import { readableError, describeEvent, eventTimeline, summarizeEvents, pickEventHighlights, needsAttention, eventStatusLabel, type PayoutEventItem } from '../src/lib/payoutEventsView';

const base: PayoutEventItem = {
  id: 'e1', status: 'completed', state: 'completed', amount: 5000, scheduled_date: '2026-11-01', installment: 4,
  created_at: '2026-11-01T11:00:00Z', executed_at: '2026-11-01T11:00:30Z', retry_count: 0, retry_after: null, error: null,
  provider: 'paystack', reference: 'AUTO_x_i3', transfer_code: null, session_id: null, transaction_id: 't1', transaction_status: 'completed',
  user: { id: 'u1', first_name: 'Matthew', last_name: 'Okpueze', email: 'm@x.com' },
  plan: { id: 'p1', name: 'Personal Salary / Allowance', purpose: 'personal_salary_allowance', frequency: 'daily', duration: 30, status: 'active', payout_amount: 5000, total_amount: 150000, completed_payouts: 3 },
  account: { bank_name: 'OPay', bank_code: '999992', account_number: '0123456789', account_name: 'MATTHEW OKPUEZE' },
  meta: { wallet_debited: true, wallet_debited_at: '2026-11-01T11:00:10Z', wallet_refund_applied: false },
};
const ev = (o: Partial<PayoutEventItem>): PayoutEventItem => ({ ...base, ...o });
let fails = 0;
const eq = (name: string, got: any, want: any) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
};

const ok = describeEvent(base);
eq('completed position', ok.position, 'Payout 4 of 30 · Daily');
eq('completed note', [ok.note, ok.flag, ok.tone], [null, null, 'normal']);
eq('account ref', ok.account?.accountNumber, '0123456789');
eq('plan installment', ok.plan?.installment, { index: 4, total: 30 });
eq('manual completed note', describeEvent(ev({ meta: { completed_via: 'manual' } })).note, 'Marked completed by an admin');

const stuck = describeEvent(ev({ status: 'processing', state: 'stuck', created_at: '2026-10-25T06:00:00Z' }));
eq('stuck', [stuck.flag, stuck.tone, stuck.note], ['Stuck', 'warn', 'Still processing since Oct 25, 2026. Money may be held.']);
eq('inflight', describeEvent(ev({ status: 'processing', state: 'in_flight' })).flag, null);

eq('held debited', describeEvent(ev({ status: 'failed', state: 'failed_held', meta: { wallet_debited: 'true', wallet_refund_applied: 'false' } })).note, 'Failed after the wallet was debited, and not refunded yet');
eq('held manual', describeEvent(ev({ status: 'failed', state: 'failed_held', meta: { manual_hold: true } })).note, 'Failed and put on hold by an admin');
const held = describeEvent(ev({ status: 'failed', state: 'failed_held', meta: { safehaven_transfer_initiated: true } as any }));
eq('held other', [held.flag, held.tone, held.note], ['Money held', 'error', 'Failed after the transfer may have started']);
const failed = describeEvent(ev({ status: 'failed', state: 'failed', error: 'Insufficient locked balance' }));
eq('failed plain', [failed.flag, failed.tone, failed.note], [null, 'error', null]);

eq('no plan', describeEvent(ev({ plan: null, installment: null })).position, null);
eq('plan unknown total', describeEvent(ev({ plan: { ...base.plan!, duration: null } })).position, 'Payout 4 · Daily');

const s = summarizeEvents([
  { status: 'completed', state: 'completed', count: 30, amount: 100000 },
  { status: 'in_progress', state: 'in_flight', count: 2, amount: 4000 },
  { status: 'in_progress', state: 'stuck', count: 3, amount: 9000 },
  { status: 'failed', state: 'failed', count: 5, amount: 2000 },
  { status: 'failed', state: 'failed_held', count: 1, amount: 700 },
]);
eq('summary', s, { total: 41, completed: { count: 30, amount: 100000 }, inProgress: { count: 5, amount: 13000 }, failed: { count: 6, amount: 2700 }, attention: { count: 4, amount: 9700 } });
eq('summary empty', summarizeEvents([]).total, 0);

eq('attention flag', [needsAttention({ state: 'stuck' }), needsAttention({ state: 'failed_held' }), needsAttention({ state: 'failed' }), needsAttention({ state: 'completed' })], [true, true, false, false]);
eq('status label', eventStatusLabel('processing'), 'Processing');

// timeline
const tl = eventTimeline(ev({ meta: { wallet_debited: true, wallet_debited_at: '2026-11-01T11:00:10Z', manual_payment_at: '2026-11-01T12:00:00Z', manual_external_reference: 'REF1', manual_notes: 'Paid via bank' }, executed_at: '2026-11-01T12:00:00Z' }));
eq('timeline order', tl.map(x => x.label), ['Due', 'Payout started', 'Wallet debited', 'Marked completed by an admin']);
eq('timeline manual detail', tl[3].detail, 'Ref REF1 · Paid via bank');
const tl2 = eventTimeline(ev({ status: 'failed', state: 'failed', error: 'Boom', executed_at: null, meta: {} }));
eq('timeline failed last', tl2.map(x => x.label), ['Due', 'Payout started', 'Failed']);
eq('timeline failed detail', [tl2[2].detail, tl2[2].tone], ['Boom', 'error']);
eq('timeline paid', eventTimeline(base).map(x => x.label), ['Due', 'Payout started', 'Wallet debited', 'Paid out']);
const tl3 = eventTimeline(ev({ meta: { wallet_debited: true, wallet_debited_at: '2026-11-01T11:00:10Z', wallet_refund_applied: true, wallet_refunded_at: '2026-11-01T11:30:00Z', wallet_refund_reason: 'Failed transfer', ops_unblocked_at: '2026-11-01T11:45:00Z', ops_unblock_reason: 'Checked' }, status: 'failed', state: 'failed', error: 'x', executed_at: null }));
eq('timeline refund+unblock', tl3.map(x => x.label), ['Due', 'Payout started', 'Wallet debited', 'Wallet refunded', 'Released for retry by an admin', 'Failed']);

// highlights
const hl = [
  ev({ id: 'a', created_at: '2026-11-01T12:00:00Z' }),
  ev({ id: 'b', created_at: '2026-11-01T11:00:00Z' }),
  ev({ id: 'c', status: 'failed', state: 'failed', created_at: '2026-11-01T09:00:00Z' }),
  ev({ id: 'd', status: 'processing', state: 'stuck', created_at: '2026-10-30T09:00:00Z' }),
];
eq('highlights urgent first, newest first', pickEventHighlights(hl, 3).map(x => x.id), ['a', 'c', 'd']);
eq('highlights fills', pickEventHighlights(hl, 4).map(x => x.id), ['a', 'b', 'c', 'd']);
eq('highlights zero', pickEventHighlights(hl, 0), []);
eq('readable plan id', readableError('Payout plan 14fdbeb9-fafd-459e-b423-f3c708582af4 is not active (status: completed)'), 'The payout plan is not active (status: completed)');
eq('readable mid', readableError('Retry blocked: Payout plan 14fdbeb9-fafd-459e-b423-f3c708582af4 paused'), 'Retry blocked: the payout plan paused');
eq('readable untouched', readableError('SafeHaven name enquiry failed: System malfunction'), 'SafeHaven name enquiry failed: System malfunction');
eq('readable empty', [readableError(null), readableError('  ')], [null, null]);
eq('reason failed', describeEvent(ev({ status: 'failed', state: 'failed', error: 'Insufficient locked balance' })).reason, 'Insufficient locked balance');
eq('reason stuck', describeEvent(ev({ status: 'processing', state: 'stuck', error: 'Payout plan 14fdbeb9-fafd-459e-b423-f3c708582af4 is not active (status: completed)' })).reason, 'The payout plan is not active (status: completed)');
eq('no reason when completed', describeEvent(ev({ error: 'old error' })).reason, null);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
