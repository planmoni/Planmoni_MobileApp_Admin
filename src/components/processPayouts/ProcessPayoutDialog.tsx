import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle2, Info, Loader2, RefreshCw, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import { AccountBlock } from '@/components/CalendarEventCard';
import { PayoutPlanIcon } from '@/components/PlanIcons';
import { formatNaira } from '@/lib/calendarEvents';
import {
  guidanceFor,
  ledgerLabel,
  outcomeTitle,
  outcomeTone,
  overdueLabel,
  processButtonLabel,
  providerLabel,
  type DuePayoutRow,
  type ProcessResult,
} from '@/lib/processPayoutsView';
import { useInspectDuePayout, useProcessDuePayout } from '@/hooks/queries/useProcessPayouts';
import { userLabel } from '@/lib/transactionsView';

const sameText = (typed: string, expected: string) =>
  typed.trim().replace(/\s+/g, ' ').toUpperCase() === expected.toUpperCase();

const stamp = (value: string | null | undefined) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy · h:mm a');
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 text-right break-words min-w-0">{children}</dd>
    </div>
  );
}

const toneClasses = {
  info: 'bg-gray-50 border-gray-200 text-gray-700',
  success: 'bg-gray-50 border-gray-300 text-gray-900',
  warn: 'bg-warning-light border-amber-300 text-amber-900',
  error: 'bg-error-light border-red-200 text-red-800',
} as const;

function Notice({
  tone,
  title,
  children,
}: {
  tone: keyof typeof toneClasses;
  title: string;
  children: React.ReactNode;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : TriangleAlert;
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <div className="text-sm mt-0.5 break-words">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Review one due payout and, when it is safe, process it. Everything shown here was read live from SafeHaven
 * and the wallet ledger a moment ago; the server checks it again before anything moves.
 */
export default function ProcessPayoutDialog({ row, onClose }: { row: DuePayoutRow | null; onClose: () => void }) {
  const planId = row?.plan_id ?? null;
  const inspect = useInspectDuePayout(planId);
  const process = useProcessDuePayout();

  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<ProcessResult | null>(null);

  // a fresh review for every plan
  useEffect(() => {
    setTyped('');
    setResult(null);
    process.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const busy = process.isPending;

  // closing mid-run would hide the outcome of real money moving
  const close = () => {
    if (!busy) onClose();
  };

  if (!row) return null;

  const data = inspect.data;
  const guidance = data ? guidanceFor(data.decision.kind) : null;
  const confirmOk = !!data?.confirm_text && sameText(typed, data.confirm_text);
  const canRun = !!data && data.actionable && confirmOk && !!data.fingerprint && !busy && !result;

  const run = () => {
    if (!data || !data.confirm_text || !data.fingerprint) return;
    process.mutate(
      { planId: row.plan_id, fingerprint: data.fingerprint, expectedKind: data.decision.kind, confirm: typed.trim() },
      {
        onSuccess: (res) => setResult(res),
        onError: (err) =>
          setResult({
            success: false,
            outcome: 'skipped',
            message: `${(err as Error).message} Nothing was sent.`,
          }),
      }
    );
  };

  const account = data?.account ?? row.account;
  const accountRef = account?.account_number
    ? {
        bankName: account.bank_name,
        bankCode: row.account?.bank_code ?? null,
        accountNumber: account.account_number,
        accountName: account.account_name,
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={close}></div>

        <div className="relative transform overflow-hidden rounded-3xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl">
          <div className="px-6 pt-6 pb-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-gray-900">Review payout</h3>
              <button
                onClick={close}
                disabled={busy}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-start gap-4 mb-4">
              <PayoutPlanIcon purpose={row.plan.purpose} name={row.plan.name} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900 break-words">{row.plan.name}</p>
                <p className="text-sm text-gray-600">
                  {row.user ? (
                    <Link to={`/users/${row.user.id}`} className="hover:underline">
                      {userLabel(row.user)}
                    </Link>
                  ) : (
                    'Unknown user'
                  )}
                  <span className="text-gray-500">
                    {' '}
                    · Payout {row.installment} of {row.duration}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Due {stamp(row.next_payout_date)} · {overdueLabel(row.days_overdue)}
                </p>
              </div>
              <p className="text-lg font-semibold text-gray-900 shrink-0">{formatNaira(data?.amount ?? row.amount)}</p>
            </div>

            <AccountBlock account={accountRef} label="Pays out to" />

            {inspect.isLoading || inspect.isFetching ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Checking SafeHaven and the wallet ledger…
              </div>
            ) : inspect.error ? (
              <div className="mt-5 space-y-3">
                <Notice tone="error" title="Could not review this payout">
                  {(inspect.error as Error).message}. Nothing was changed.
                </Notice>
                <button
                  onClick={() => inspect.refetch()}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try again
                </button>
              </div>
            ) : data ? (
              <div className="mt-5 space-y-4">
                {/* what was found */}
                <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-100 px-4">
                  <Row label="Payout status">
                    {data.attempt ? `${data.attempt.status.charAt(0).toUpperCase()}${data.attempt.status.slice(1)}` : 'Not started'}
                    {data.attempt?.updated_at ? <span className="text-gray-500"> · {stamp(data.attempt.updated_at)}</span> : null}
                  </Row>
                  {data.attempt?.reference && (
                    <Row label="Reference">
                      <span className="font-mono text-xs break-all">{data.attempt.reference}</span>
                    </Row>
                  )}
                  {data.attempt?.error && <Row label="Last error">{data.attempt.error}</Row>}
                  {data.attempt && (
                    <Row label="Wallet">
                      {data.attempt.wallet_debited
                        ? data.attempt.wallet_refund_applied
                          ? 'Debited, then refunded'
                          : 'Debited'
                        : 'Not debited'}
                    </Row>
                  )}
                  {data.ledger && <Row label="Ledger says">{ledgerLabel(data.ledger.verdict)}</Row>}
                  {data.provider && <Row label="SafeHaven says">{providerLabel(data.provider.status)}</Row>}
                </dl>

                {/* what the page found out and what it will do */}
                {!result && (
                  <Notice
                    tone={data.actionable ? 'info' : guidance?.tone === 'info' ? 'info' : 'error'}
                    title={data.actionable ? 'What will happen' : (guidance?.title ?? 'Not processed here')}
                  >
                    {data.actionable ? (
                      <ul className="list-disc pl-4 space-y-1">
                        <li>{data.decision.reason}</li>
                        {data.effects.map((effect) => (
                          <li key={effect}>{effect}</li>
                        ))}
                      </ul>
                    ) : (
                      <>
                        <p>{data.decision.reason}</p>
                        {guidance && <p className="mt-1">{guidance.body}</p>}
                      </>
                    )}
                  </Notice>
                )}

                {/* outcome */}
                {result && (
                  <Notice tone={outcomeTone(result.outcome)} title={outcomeTitle(result.outcome)}>
                    <p>{result.message}</p>
                    {result.run_id && <p className="text-xs opacity-70 mt-1 font-mono break-all">Run {result.run_id}</p>}
                  </Notice>
                )}

                {/* typed confirmation */}
                {data.actionable && !result && data.confirm_text && (
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">
                      This sends real money. Type{' '}
                      <span className="font-mono font-semibold text-gray-900 select-all">{data.confirm_text}</span> to confirm.
                    </label>
                    <input
                      type="text"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canRun) run();
                      }}
                      disabled={busy}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={data.confirm_text}
                      className="block w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>
                )}

                {busy && (
                  <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Processing. Keep this window open until it reports back; this can take up to a minute.
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    onClick={() => {
                      setResult(null);
                      setTyped('');
                      inspect.refetch();
                    }}
                    disabled={busy}
                    className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check again
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={close}
                      disabled={busy}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                    >
                      {result ? 'Close' : 'Cancel'}
                    </button>
                    {data.actionable && !result && (
                      <button
                        onClick={run}
                        disabled={!canRun}
                        className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                        {processButtonLabel(data.decision.kind)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
