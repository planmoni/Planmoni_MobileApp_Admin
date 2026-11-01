import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { VaultIcon } from '@/components/PlanIcons';
import { Field, StatusPill, naira, titleCase } from '@/components/userDetails/ui';

/** One vault on a user's profile: budget, how much is funded, and auto top-up. */
export default function VaultCard({ vault }: { vault: any }) {
  const budget = Number(vault.total_budget) || 0;
  const balance = Number(vault.current_balance) || 0;
  const pct = budget > 0 ? Math.min(100, Math.round((balance / budget) * 100)) : 0;

  return (
    <div className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <VaultIcon categories={vault.categories} subcategories={vault.subcategories} name={vault.name} />
          <div className="min-w-0">
            <h3 className="text-sm md:text-base font-semibold text-gray-900 truncate">{vault.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {vault.plan_name && vault.plan_name !== vault.name ? `${vault.plan_name} · ` : ''}
              {vault.created_at ? `created ${format(new Date(vault.created_at), 'MMM d, yyyy')}` : ''}
            </p>
          </div>
        </div>
        <StatusPill status={vault.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 rounded-xl bg-gray-50 p-3.5">
        <Field label="Total budget" value={naira(budget)} />
        <Field label="Funded" value={naira(balance)} />
        <Field label="Left to fund" value={naira(Math.max(budget - balance, 0))} />
        <Field label="Wallet balance" value={naira(vault.plan_wallets?.[0]?.balance)} />
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{pct}% funded</span>
          {vault.start_date && (
            <span>
              {format(new Date(vault.start_date), 'MMM d, yyyy')}
              {vault.end_date && ` – ${format(new Date(vault.end_date), 'MMM d, yyyy')}`}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-gray-900 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {vault.auto_topup_enabled ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Auto top-up {naira(vault.auto_topup_amount)} · {titleCase(vault.auto_topup_frequency) || 'N/A'}
          </p>
        ) : (
          <span />
        )}
        <Link
          to={`/vaults/${vault.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Vault details
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
