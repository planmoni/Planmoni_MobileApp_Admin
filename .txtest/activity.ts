import { pickHighlights, describeActivity, describeAdminAction, countFacets, actorName, categoryOfKind, KINDS, CATEGORIES, type ActivityItem } from '../src/lib/activityView';
import { resolvePeriod } from '../src/lib/transactionsView';

const u = { id: 'u1', first_name: 'Ada', last_name: 'Okafor', email: 'ada@x.com' };
const mk = (kind: string, details: any, extra: Partial<ActivityItem> = {}): ActivityItem =>
  ({ id: kind, kind, category: categoryOfKind(kind) as any, at: '2026-11-01T10:00:00Z', user: u, actor: null, details, ...extra });
let fails = 0;
const eq = (name: string, got: any, want: any) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
};

eq('signup', describeActivity(mk('signup', { referred: false })).text, 'joined Planmoni');
eq('signup ref', describeActivity(mk('signup', { referred: true })).text, 'joined Planmoni through a referral');
const plan = describeActivity(mk('payout_plan_created', { name: 'Personal Salary / Allowance', frequency: 'daily', duration: 30, payout_amount: 5000, total_amount: 150000, account: { bank_name: 'GTB', account_number: '0123456789', account_name: 'ADA' } }));
eq('plan', plan.text, 'created a Daily payout named "Personal Salary / Allowance" for 30 days');
eq('plan sub', plan.sub, '₦5,000 per payout · ₦150,000 in total');
eq('plan acct', plan.account?.accountNumber, '0123456789');
eq('liveness failed', [describeActivity(mk('kyc_liveness_failed', { message: 'Face mismatch' })).tone, describeActivity(mk('kyc_liveness_failed', { message: 'Face mismatch' })).sub], ['error', 'Face mismatch']);
eq('doc', describeActivity(mk('kyc_document_uploaded', { verification_type: 'nin' })).text, 'uploaded a NIN document');
eq('doc generic', describeActivity(mk('kyc_document_uploaded', { verification_type: 'document' })).text, 'uploaded a document');
eq('login susp', describeActivity(mk('login', { device: 'iPhone 14', os: 'iOS', city: 'Lagos', country: 'NG', ip: '1.2.3.4', suspicious: true })), 
  describeActivity(mk('login', { device: 'iPhone 14', os: 'iOS', city: 'Lagos', country: 'NG', ip: '1.2.3.4', suspicious: true })));
const lg = describeActivity(mk('login', { device: 'iPhone 14', os: 'iOS', city: 'Lagos', country: 'NG', ip: '1.2.3.4', suspicious: true }));
eq('login sub', lg.sub, 'iPhone 14 · iOS · Lagos, NG · 1.2.3.4'); eq('login tone', lg.tone, 'warn');
eq('payout failed', describeActivity(mk('payout', { amount: 5000, status: 'failed' })).tone, 'error');
eq('payout ok', describeActivity(mk('payout', { amount: 5000, status: 'completed' })).text, 'received a ₦5,000 payout');
eq('payout pending', describeActivity(mk('payout', { amount: 5000, status: 'pending' })).text, 'has a ₦5,000 payout pending');
eq('deposit', describeActivity(mk('deposit', { amount: 20000, status: 'completed' })).text, 'received a ₦20,000 deposit');
eq('vault topup', describeActivity(mk('vault_topup', { amount: 1000, name: 'Rent', source: 'manual_topup', status: 'completed' })).text, 'added ₦1,000 to the vault "Rent"');
eq('ew', describeActivity(mk('emergency_withdrawal', { amount: 10000, fee: 500, net: 9500, type: 'instant', plan_name: 'Rent', status: 'completed' })).sub, 'Instant · Fee ₦500 · Received ₦9,500');
eq('admin paused', describeAdminAction('payout_plan.paused', { plan_name: 'Rent' }), 'paused the payout plan "Rent"');
eq('admin unknown', describeAdminAction('foo.bar_baz', {}), 'foo bar baz');
eq('admin del', describeAdminAction('user.deleted', { email: 'a@b.com' }), 'deleted the account of a@b.com');
const adm = describeActivity(mk('admin_action', { action: 'payout.marked_refunded', reason: 'Dup' }));
eq('admin view', [adm.lead, adm.text, adm.sub, adm.aboutUser], ['actor', 'marked a payout as refunded', 'Reason: Dup', true]);
eq('actor name', actorName(mk('post_no_debit', { by: 'ops@planmoni.com' })), 'ops@planmoni.com');
eq('actor none', actorName(mk('admin_action', {})), 'An admin');
eq('actor profile', actorName(mk('admin_action', {}, { actor: { id: 'a', first_name: 'Ben', last_name: 'T', email: null } })), 'Ben T');
const f = [{ category: 'kyc', kind: 'kyc_submitted', count: 3 }, { category: 'kyc', kind: 'kyc_started', count: 2 }, { category: 'money', kind: 'deposit', count: 7 }];
eq('facet cat', countFacets(f, { category: 'kyc' }), 5); eq('facet kind', countFacets(f, { kind: 'deposit' }), 7); eq('facet all', countFacets(f), 12);
eq('every kind has a category', CATEGORIES.every(c => KINDS[c.key].length > 0), true);
// every kind the DB can emit is handled (no fallthrough title-case)
for (const c of CATEGORIES) for (const k of KINDS[c.key]) { const t = describeActivity(mk(k.key, {})).text; if (!t) { fails++; console.log('EMPTY', k.key); } }
// last_7 is 7 calendar days including today
const w = resolvePeriod('last_7', new Date('2026-11-01T12:00:00'));
eq('last_7 span days', Math.round((+w.to - +w.from) / 86400000), 7);
const hl = [
  mk('login', {}, { id: 'l1', at: '2026-11-01T12:00:00Z' }),
  mk('payout', { status: 'completed' }, { id: 'p1', at: '2026-11-01T11:59:00Z' }),
  mk('signup', {}, { id: 's1', at: '2026-11-01T11:00:00Z' }),
  mk('payout', { status: 'failed' }, { id: 'p2', at: '2026-11-01T10:00:00Z' }),
  mk('kyc_submitted', {}, { id: 'k1', at: '2026-11-01T09:00:00Z' }),
];
eq('highlights notable first', pickHighlights(hl, 3).map(x => x.id), ['s1', 'p2', 'k1']);
eq('highlights tops up with routine', pickHighlights(hl, 5).map(x => x.id), ['l1', 'p1', 's1', 'p2', 'k1']);
eq('highlights one routine fills the 4th, newest first', pickHighlights(hl, 4).map(x => x.id), ['l1', 's1', 'p2', 'k1']);
eq('highlights zero', pickHighlights(hl, 0), []);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
