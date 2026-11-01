import type { ReactNode } from 'react';
import { X, User, ExternalLink, TriangleAlert, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { usePayoutEventState } from '@/hooks/queries/usePayoutEventsList';
import { AccountBlock } from '@/components/CalendarEventCard';
import { InstallmentActions } from '@/components/PayoutActions';
import { EventFlag, EventStatusBadge } from '@/components/PayoutEventRow';
import { PayoutPlanIcon } from '@/components/PlanIcons';
import { describePlanSchedule, formatNaira, toNumber } from '@/lib/calendarEvents';
import {
  describeEvent,
  eventTimeline,
  eventUserName,
  formatStep,
  type PayoutEventItem,
} from '@/lib/payoutEventsView';
import { titleCase } from '@/lib/transactionsView';

const stamp = (value: string | null | undefined) => (value ? format(new Date(value), 'MMM d, yyyy · h:mm a') : null);

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 text-right break-all">{children}</dd>
    </div>
  );
}

const mono = (value: string) => <span className="font-mono text-xs">{value}</span>;

export default function PayoutEventDetailsModal({
  event,
  isOpen,
  onClose,
}: {
  event: PayoutEventItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { isSuperAdmin, hasPermission } = usePermissions();

  const canManage = isSuperAdmin || hasPermission('payout_plans', 'manage');
  const userId = event?.user?.id || null;
  const resolvable = !!event && event.status !== 'completed';
  const { data: payoutState } = usePayoutEventState(event?.id, isOpen && canManage && resolvable);

  if (!isOpen || !event) return null;

  const view = describeEvent(event);
  const failed = event.status === 'failed';
  const showActions = canManage && !!userId && !!payoutState && payoutState.state !== 'completed';
  // the failure reason is shown once: in the action panel when there is one, otherwise in its own panel
  const showReason = !!view.reason && !showActions;

  const openProfile = () => {
    if (!userId) return;
    onClose();
    navigate(`/users/${userId}`);
  };

  const plan = event.plan;
  const schedule = plan ? describePlanSchedule(plan.frequency, toNumber(plan.duration)) : null;
  // the action panel already says why it failed, so the timeline does not repeat it
  const steps = eventTimeline(event).map((step) => (showActions && step.tone === 'error' ? { ...step, detail: null } : step));

  const retryDue = event.retry_after && new Date(event.retry_after) > new Date() ? stamp(event.retry_after) : null;

  const candidateDetails: Array<[string, ReactNode] | null> = [
    ['Event ID', mono(event.id)],
    plan
      ? [
          'Plan',
          `${schedule?.frequencyLabel ?? 'Payout'} · ${formatNaira(toNumber(plan.payout_amount))} each${
            schedule?.durationText ? ` · ${schedule.durationText}` : ''
          }`,
        ]
      : null,
    plan?.status ? ['Plan status', titleCase(plan.status)] : null,
    event.scheduled_date ? ['Scheduled for', format(new Date(`${event.scheduled_date}T12:00:00`), 'MMM d, yyyy')] : null,
    ['Started', stamp(event.created_at)],
    event.executed_at ? [event.status === 'completed' ? 'Paid out' : 'Last attempt', stamp(event.executed_at)] : null,
    event.retry_count ? ['Retries', String(event.retry_count)] : null,
    retryDue ? ['Next retry', retryDue] : null,
    event.provider ? ['Transfer provider', titleCase(event.provider)] : null,
    event.reference ? ['Reference', mono(event.reference)] : null,
    event.transfer_code ? ['Transfer code', mono(event.transfer_code)] : null,
    event.session_id ? ['Session ID', mono(event.session_id)] : null,
    event.transaction_id
      ? ['Transaction', <span key="tx">{event.transaction_status ? titleCase(event.transaction_status) : 'Linked'} · {mono(event.transaction_id)}</span>]
      : null,
  ];
  const details = candidateDetails.filter((row): row is [string, ReactNode] => !!row && row[1] !== null && row[1] !== undefined);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="relative transform overflow-hidden rounded-3xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-gray-900">Payout event</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* What happened */}
            <div className="flex items-start gap-4 mb-5">
              <PayoutPlanIcon purpose={plan?.purpose} name={plan?.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-gray-900 break-words">{plan?.name ?? 'Payout plan'}</p>
                  <EventStatusBadge status={event.status} />
                  <EventFlag flag={view.flag} tone={view.tone} />
                </div>
                <p className="text-lg font-semibold text-gray-900 mt-1">{formatNaira(event.amount)}</p>
                {view.position && <p className="text-sm text-gray-500 mt-0.5">{view.position}</p>}
              </div>
            </div>

            <div className="space-y-5">
              {event.user && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{eventUserName(event)}</p>
                      {event.user.email && <p className="text-xs text-gray-500 truncate">{event.user.email}</p>}
                    </div>
                  </div>
                  {userId && (
                    <button
                      onClick={openProfile}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 shrink-0"
                    >
                      Open profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <AccountBlock account={view.account} label={event.status === 'completed' ? 'Paid to' : 'Pays out to'} />

              {view.note && (
                <div
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${
                    view.tone === 'error'
                      ? 'bg-error-light text-red-800'
                      : view.tone === 'warn'
                        ? 'bg-warning-light text-amber-900'
                        : 'bg-gray-50 border border-gray-100 text-gray-700'
                  }`}
                >
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="text-sm">{view.note}</p>
                </div>
              )}

              {showReason && (
                <div className="flex items-start gap-2 rounded-xl bg-error-light px-3 py-2.5">
                  <TriangleAlert className="h-4 w-4 text-error mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">{failed ? 'Why it failed' : 'What the system reported'}</p>
                    <p className="text-sm text-red-800 break-words">{view.reason}</p>
                  </div>
                </div>
              )}

              {/* How it got here */}
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-3">Timeline</p>
                <ol className="space-y-3">
                  {steps.map((step, i) => (
                    <li key={`${step.label}-${i}`} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                            step.tone === 'error' ? 'bg-error' : 'bg-gray-900'
                          }`}
                        />
                        {i < steps.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      <div className="pb-1 min-w-0">
                        <p className={`text-sm font-medium ${step.tone === 'error' ? 'text-red-700' : 'text-gray-900'}`}>
                          {step.label}
                          {formatStep(step.at) && <span className="font-normal text-gray-500"> · {formatStep(step.at)}</span>}
                        </p>
                        {step.detail && (
                          <p className={`text-xs mt-0.5 break-words ${step.tone === 'error' ? 'text-error' : 'text-gray-500'}`}>
                            {step.detail}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <dl className="divide-y divide-gray-100 border-t border-gray-100">
                {details.map(([label, value]) => (
                  <Detail key={label} label={label}>
                    {value}
                  </Detail>
                ))}
              </dl>
            </div>
          </div>

          {showActions && userId && payoutState && (
            <div className="px-6 pb-5">
              <InstallmentActions userId={userId} state={payoutState} variant="modal" onDone={onClose} />
            </div>
          )}

          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            {userId && (
              <button
                onClick={openProfile}
                className="px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium border border-gray-200 flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                View profile
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
