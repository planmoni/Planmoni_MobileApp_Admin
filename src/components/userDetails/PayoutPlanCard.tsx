import { format } from 'date-fns';
import { Clock, ListChecks } from 'lucide-react';
import { PayoutCountdown } from '@/components/PayoutCountdown';
import { PayoutPlanIcon } from '@/components/PlanIcons';
import { BankLogo } from '@/components/BankAccountRow';
import { InstallmentActions, PlanControls } from '@/components/PayoutActions';
import { Field, StatusPill, naira, titleCase } from '@/components/userDetails/ui';

/** One payout plan on a user's profile: progress, next payout, destination account and the admin controls. */
export default function PayoutPlanCard({
  userId,
  plan,
  purpose,
  endDate,
  actions,
  canManage,
  onBreakdown,
}: {
  userId: string;
  plan: any;
  purpose?: string | null;
  endDate: Date | null;
  actions?: any;
  canManage: boolean;
  onBreakdown: () => void;
}) {
  const duration = Number(plan.duration) || 0;
  const done = Number(plan.completed_payouts) || 0;
  const pct = duration > 0 ? Math.min(100, Math.round((done / duration) * 100)) : 0;
  const nextDate = plan.next_payout_date ? new Date(plan.next_payout_date) : null;
  const showNext = plan.status === 'active' && nextDate && !isNaN(nextDate.getTime());

  return (
    <div className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <PayoutPlanIcon purpose={purpose} name={plan.name} />
          <div className="min-w-0">
            <h3 className="text-sm md:text-base font-semibold text-gray-900 truncate">{plan.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {titleCase(plan.frequency)} · {duration} payouts
              {plan.created_at && ` · created ${format(new Date(plan.created_at), 'MMM d, yyyy')}`}
            </p>
          </div>
        </div>
        <StatusPill status={plan.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-3.5">
        <Field label="Total amount" value={naira(plan.total_amount)} />
        <Field label="Per payout" value={naira(plan.payout_amount)} />
        <Field label="Paid out" value={`${done} of ${duration}`} />
        <Field
          label="Ends"
          value={endDate && !isNaN(endDate.getTime()) ? format(endDate, 'MMM d, yyyy') : '-'}
        />
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{pct}% complete</span>
          <span>{Math.max(duration - done, 0)} remaining</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gray-900 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {(showNext || plan.bank_account) && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {showNext && nextDate && (
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Clock className="h-4 w-4 text-gray-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Next payout in</p>
                <PayoutCountdown
                  targetDate={plan.next_payout_date}
                  className="font-mono text-sm font-semibold text-gray-900"
                />
                <p className="text-xs text-gray-400">Due {format(nextDate, 'MMM d, yyyy')}</p>
              </div>
            </div>
          )}
          {plan.bank_account && (
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 min-w-0">
              <BankLogo
                bankName={plan.bank_account.bank_name}
                bankCode={plan.bank_account.bank_code}
                className="w-9 h-9"
                wideClassName="w-14 h-9"
              />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Pays out to</p>
                <p className="text-sm font-medium text-gray-900 truncate">{plan.bank_account.account_name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {plan.bank_account.bank_name} · <span className="font-mono">{plan.bank_account.account_number}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {canManage && actions?.current && <InstallmentActions userId={userId} state={actions.current} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onBreakdown}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <ListChecks className="h-4 w-4" />
          Plan breakdown
        </button>
        {canManage && <PlanControls userId={userId} plan={plan} actions={actions} />}
      </div>
    </div>
  );
}
