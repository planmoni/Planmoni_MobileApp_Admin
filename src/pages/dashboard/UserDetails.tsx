import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Building2,
  Calendar,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Clock,
  CreditCard,
  RefreshCw,
  Shield,
  Ban,
  Vault,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, formatDistanceToNow } from 'date-fns';
import { useUserDetails, useUserRestriction, useUserGeneratedAccounts } from '@/hooks/queries/useUsersData';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import SendReengagementButton from '@/components/SendReengagementButton';
import UserActionsMenu from '@/components/UserActionsMenu';
import BankAccountRow from '@/components/BankAccountRow';
import { usePayoutPlanPurposes } from '@/hooks/queries/usePlanIcons';
import { useUserPayoutActions } from '@/hooks/queries/usePayoutActions';
import TransactionDetailsModal from '@/components/TransactionDetailsModal';
import PlanBreakdownModal from '@/components/PlanBreakdownModal';
import { TransactionStatusBadge } from '@/components/TransactionRow';
import { TierBadge } from '@/components/KycBadges';
import type { KycTier } from '@/hooks/queries/useKycData';
import PayoutPlanCard from '@/components/userDetails/PayoutPlanCard';
import VaultCard from '@/components/userDetails/VaultCard';
import KycPanel from '@/components/userDetails/KycPanel';
import { EmptyState, Panel, naira } from '@/components/userDetails/ui';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'plans', label: 'Payout plans' },
  { id: 'vaults', label: 'Vaults' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'kyc', label: 'KYC' },
  { id: 'activity', label: 'Activity' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const eventIcon = (type: string): LucideIcon => {
  if (type.includes('payout')) return Banknote;
  if (type.includes('kyc')) return ClipboardCheck;
  if (type.includes('transaction')) return CreditCard;
  if (type.includes('notification')) return Bell;
  return Zap;
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 shadow-soft border border-gray-100 min-w-0">
      <p className="text-xs text-gray-500 truncate">{label}</p>
      <p className="mt-1 text-base md:text-lg font-semibold text-gray-900 tabular-nums whitespace-nowrap leading-snug">
        {value}
      </p>
    </div>
  );
}

function TransactionList({
  items,
  onOpen,
  attention,
}: {
  items: any[];
  onOpen: (t: any) => void;
  attention: (t: any) => boolean;
}) {
  return (
    <div className="divide-y divide-gray-100">
      {items.map((t) => {
        const isIn = t.type === 'deposit';
        return (
          <button
            key={t.id}
            onClick={() => onOpen(t)}
            className="w-full text-left px-4 md:px-5 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                {isIn ? (
                  <ArrowDownRight className="h-4 w-4 text-gray-700" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-gray-700" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 capitalize">{t.type}</p>
                <p className="text-xs text-gray-500">{format(new Date(t.created_at), 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {attention(t) && <span className="hidden sm:inline text-xs text-gray-500">Open to resolve</span>}
              <TransactionStatusBadge status={t.status} />
              <p className="w-28 text-right text-sm font-semibold text-gray-900 tabular-nums">
                {isIn ? '+' : '-'}
                {naira(t.amount)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EventList({ events }: { events: any[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {events.map((event) => {
        const Icon = eventIcon(String(event.type || ''));
        return (
          <li key={event.id} className="px-4 md:px-5 py-3 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-gray-900">{event.title}</p>
                <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(event.created_at), 'MMM d, h:mm a')}
                </span>
              </div>
              {event.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{event.description}</p>}
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                    event.status === 'failed'
                      ? 'bg-error-light text-red-700'
                      : event.status === 'pending'
                        ? 'bg-warning-light text-amber-800'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {event.status}
                </span>
                <span className="px-2 py-0.5 rounded-md text-xs text-gray-500 bg-gray-50">{event.type}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: userDetailsData, isLoading, error } = useUserDetails(id!);
  const refreshData = useRefreshData();
  const { isSuperAdmin, hasPermission } = usePermissions();
  const canRestrict = isSuperAdmin || hasPermission('users', 'details');
  const canDelete = isSuperAdmin || hasPermission('users', 'delete');
  const canManagePayouts = isSuperAdmin || hasPermission('payout_plans', 'manage');
  const { data: payoutActions } = useUserPayoutActions(id, canManagePayouts);
  const { data: restriction } = useUserRestriction(id!);
  const { data: generatedAccounts, isLoading: accountsLoading, error: accountsError } = useUserGeneratedAccounts(id!);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [breakdownPlan, setBreakdownPlan] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'overview';
  const setTab = (next: TabId) => setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });

  const { data: userActivity } = useQuery({
    queryKey: ['user-activity', id],
    queryFn: async () => {
      const [auditResult, eventsResult] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('events')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      if (auditResult.error) throw auditResult.error;
      if (eventsResult.error) throw eventsResult.error;

      return {
        auditLogs: auditResult.data || [],
        events: eventsResult.data || []
      };
    },
    enabled: !!id,
  });

  const { data: purposeMap } = usePayoutPlanPurposes((userDetailsData?.payoutPlans || []).map((p: any) => p.id));

  const { data: userVaults } = useQuery({
    queryKey: ['user-vaults', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_plans')
        .select('*, plan_wallets(*)')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleRefresh = () => {
    if (id) {
      refreshData.mutate(['user', id]);
    }
  };

  const handleTransactionClick = (transaction: any) => {
    let destinationBankName = transaction.destination_bank_name || null;
    let destinationAccountNumber = transaction.destination_account_number || null;
    let destinationAccountName = transaction.destination_account_name || null;

    if ((transaction.type === 'payout' || transaction.type === 'withdrawal') && !destinationBankName) {
      const matchingAccount = bankAccounts.find((acc: any) =>
        acc.id === transaction.payout_account_id ||
        acc.id === transaction.bank_account_id
      );
      const fallbackAccount = bankAccounts.find((acc: any) => acc.is_default) || bankAccounts[0];
      const account = matchingAccount || fallbackAccount;
      if (account) {
        destinationBankName = account.bank_name;
        destinationAccountNumber = account.account_number;
        destinationAccountName = account.account_name;
      }
    }

    const enrichedTransaction = {
      ...transaction,
      user_id: transaction.user_id || id,
      destination_bank_name: destinationBankName,
      destination_account_number: destinationAccountNumber,
      destination_account_name: destinationAccountName,
      profiles: transaction.profiles || [{
        id: id || '',
        first_name: user?.first_name || null,
        last_name: user?.last_name || null,
        email: user?.email || '',
      }],
    };
    setSelectedTransaction(enrichedTransaction);
    setIsTransactionModalOpen(true);
  };

  const handleCloseTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setSelectedTransaction(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !userDetailsData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600 mb-4">User not found</h2>
        <p className="text-gray-500 mb-6">
          The user you're looking for doesn't exist or may have been removed.
        </p>
        <Link
          to="/users"
          className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Users
        </Link>
      </div>
    );
  }

  const { user, transactions, payoutPlans, bankAccounts, kycData, kycProgress, totalDeposits, totalPayouts } = userDetailsData;

  // Calculate user stats

  const activePlans = payoutPlans.filter((p: any) => p.status === 'active').length;
  const completedPlans = payoutPlans.filter((p: any) => p.status === 'completed').length;
  const cancelledPlans = payoutPlans.filter((p: any) => p.status === 'cancelled').length;

  // Filter out completed and cancelled plans for display
  const activePayoutPlans = payoutPlans.filter((p: any) => p.status !== 'completed' && p.status !== 'cancelled');

  // Calculate end date for a payout plan
  const calculateEndDate = (plan: any) => {
    if (!plan.start_date) return null;

    const startDate = new Date(plan.start_date);
    if (isNaN(startDate.getTime())) return null;

    const remaining = plan.duration - 1;

    switch (plan.frequency) {
      case 'daily':
      case 'specific_days':
        return addDays(startDate, remaining);
      case 'weekly':
      case 'weekly_specific':
        return addWeeks(startDate, remaining);
      case 'biweekly':
      case 'bi-weekly':
        return addWeeks(startDate, remaining * 2);
      case 'monthly':
        return addMonths(startDate, remaining);
      case 'end_of_month':
      case 'month_end': {
        const d = addMonths(startDate, remaining);
        return new Date(d.getFullYear(), d.getMonth() + 1, 0);
      }
      case 'quarterly':
        return addMonths(startDate, remaining * 3);
      case 'biannually':
      case 'bi-annually':
        return addMonths(startDate, remaining * 6);
      case 'annually':
        return addMonths(startDate, remaining * 12);
      case 'custom': {
        if (plan.next_payout_date && plan.completed_payouts > 0) {
          const nextDate = new Date(plan.next_payout_date);
          const intervalDays = Math.round(
            (nextDate.getTime() - startDate.getTime()) / (plan.completed_payouts * 86400000)
          );
          if (intervalDays > 0) {
            return addDays(startDate, intervalDays * remaining);
          }
        }
        if (plan.next_payout_date && plan.completed_payouts === plan.duration - 1) {
          return new Date(plan.next_payout_date);
        }
        return startDate;
      }
      default:
        return startDate;
    }
  };

  const userBalance = user.wallets?.[0]?.balance || 0;
  const hasDeposits = totalDeposits > 0;
  const hasUnfundedVaults = (userVaults || []).some((v: any) => v.is_active && (!v.plan_wallets?.[0]?.balance || v.plan_wallets[0].balance === 0));

  // Calculate if user is inactive (14+ days since last seen)
  const isInactive = (() => {
    if (!user.last_seen_at) return true; // Never logged in = inactive
    const lastSeen = new Date(user.last_seen_at);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    return lastSeen < fourteenDaysAgo;
  })();


  const tier: KycTier = (
    kycProgress?.tier_3_completed ? 3 : kycProgress?.tier_2_completed ? 2 : kycProgress?.tier_1_completed ? 1 : 0
  ) as KycTier;
  const wallet = user.wallets?.[0];
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  const needsAttention = (t: any) => {
    const a = payoutActions?.transactions[t.id];
    return !!(
      canManagePayouts &&
      (t.status === 'pending' || t.status === 'failed') &&
      a &&
      (a.can_complete || a.can_refund || a.can_retry)
    );
  };
  const vaults = userVaults || [];
  const events = userActivity?.events || [];
  const tabCount: Partial<Record<TabId, number>> = {
    plans: activePayoutPlans.length,
    vaults: vaults.length,
  };

  const accountsPanels = (
    <>
      <Panel
        title="Planmoni account number"
        subtitle="Generated after KYC. Deposits are received here."
        flush
      >
        {accountsLoading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-400"></div>
          </div>
        ) : accountsError ? (
          <div className="p-5 text-sm text-error">
            Could not load account numbers
            {(accountsError as { message?: string })?.message ? `: ${(accountsError as { message?: string }).message}` : ''}
          </div>
        ) : generatedAccounts && generatedAccounts.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {generatedAccounts.map((account) => (
              <BankAccountRow
                key={account.account_number}
                bankName={account.bank_name}
                bankCode={account.bank_code}
                accountNumber={account.account_number}
                accountName={account.account_name}
                badges={[account.status, account.is_default ? 'Primary' : null].filter(Boolean) as string[]}
                footer={account.created_at ? <span>Created {format(new Date(account.created_at), 'MMM d, yyyy')}</span> : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="No account number generated"
            hint="An account number is created once the user completes KYC"
          />
        )}
      </Panel>

      <Panel title="Payout accounts" subtitle="Bank accounts the user can be paid out to" flush>
        {bankAccounts.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {bankAccounts.map((account: any) => (
              <BankAccountRow
                key={account.id}
                bankName={account.bank_name}
                bankCode={account.bank_code || account.safehaven_bank_code}
                accountNumber={account.account_number}
                accountName={account.account_name}
                badges={account.is_default ? ['Default'] : []}
                footer={
                  <>
                    <span>Added {format(new Date(account.created_at), 'MMM d, yyyy')}</span>
                    {account.paystack_recipient_code && (
                      <>
                        <span>•</span>
                        <span className="font-mono">{account.paystack_recipient_code}</span>
                      </>
                    )}
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={Building2} title="No payout accounts added" hint="User hasn't added any bank accounts yet" />
        )}
      </Panel>
    </>
  );

  const transactionsEmpty = (
    <EmptyState icon={CreditCard} title="No transactions found" hint="User hasn't made any transactions yet" />
  );

  return (
    <div className="space-y-5">
      <Link to="/users" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Users
      </Link>

      {/* not clipped, so the Send Alert / Actions menus can open over the cards below */}
      <Panel allowOverflow>
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
            {user.first_name?.[0]}
            {user.last_name?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">{fullName || user.email}</h1>
              <TierBadge tier={tier} size="sm" />
              {user.is_admin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-900 text-white">
                  <Shield className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5 break-all">{user.email}</p>
            <p className="text-xs text-gray-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {user.last_seen_at
                  ? `Last seen ${formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })}`
                  : 'Never opened the app'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SendReengagementButton
              userId={id!}
              userBalance={userBalance}
              hasActivePlans={activePlans > 0}
              hasDeposits={hasDeposits}
              hasUnfundedVaults={hasUnfundedVaults}
              isInactive={isInactive}
            />
            <button
              onClick={handleRefresh}
              className="p-2.5 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-200"
              disabled={refreshData.isPending}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
            </button>
            <UserActionsMenu userId={id!} userName={fullName} canRestrict={canRestrict} canDelete={canDelete} />
          </div>
        </div>

        {restriction?.post_no_debit && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm">
            <Ban className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-900" />
            <div>
              <p className="font-semibold text-gray-900">Post No Debit</p>
              <p className="text-gray-600">
                Cannot create payout plans or lock funds.
                {restriction.post_no_debit_reason && ` Reason: ${restriction.post_no_debit_reason}.`}
              </p>
              {(restriction.post_no_debit_by || restriction.post_no_debit_at) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {restriction.post_no_debit_by && `Applied by ${restriction.post_no_debit_by}`}
                  {restriction.post_no_debit_at &&
                    `${restriction.post_no_debit_by ? ' on ' : 'Applied '}${format(new Date(restriction.post_no_debit_at), 'MMM d, yyyy')}`}
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
        <StatTile label="Available balance" value={naira(wallet?.balance)} />
        <StatTile label="Locked balance" value={naira(wallet?.locked_balance)} />
        <StatTile
          label="Total balance"
          value={naira((wallet?.balance || 0) + (wallet?.locked_balance || 0))}
        />
        <StatTile label="Total deposits" value={naira(totalDeposits)} />
        <StatTile label="Total payouts" value={naira(totalPayouts)} />
        <StatTile label="Active plans" value={activePlans.toLocaleString()} />
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => {
          const count = tabCount[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {count !== undefined && count > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="space-y-5">{accountsPanels}</div>
          <div className="space-y-5">
            <Panel
              title="Recent transactions"
              flush
              action={
                transactions.length > 0 ? (
                  <button onClick={() => setTab('transactions')} className="text-sm font-medium text-primary hover:underline">
                    See all
                  </button>
                ) : undefined
              }
            >
              {transactions.length > 0 ? (
                <TransactionList items={transactions.slice(0, 5)} onOpen={handleTransactionClick} attention={needsAttention} />
              ) : (
                transactionsEmpty
              )}
            </Panel>
            <Panel
              title="Recent activity"
              flush
              action={
                events.length > 0 ? (
                  <button onClick={() => setTab('activity')} className="text-sm font-medium text-primary hover:underline">
                    See all
                  </button>
                ) : undefined
              }
            >
              {events.length > 0 ? (
                <EventList events={events.slice(0, 4)} />
              ) : (
                <EmptyState icon={Zap} title="No recent events" />
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <Panel
          title="Payout plans"
          subtitle="Active and paused plans"
          flush
          action={
            <div className="flex items-center gap-2">
              <Link
                to={`/users/${id}/completed-payouts`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <CircleCheck className="h-3.5 w-3.5" />
                Completed ({completedPlans})
              </Link>
              <Link
                to={`/users/${id}/cancelled-payouts`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <CircleX className="h-3.5 w-3.5" />
                Cancelled ({cancelledPlans})
              </Link>
            </div>
          }
        >
          {activePayoutPlans.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {activePayoutPlans.map((plan: any) => (
                <PayoutPlanCard
                  key={plan.id}
                  userId={id!}
                  plan={plan}
                  purpose={purposeMap?.[plan.id]}
                  endDate={calculateEndDate(plan)}
                  actions={payoutActions?.plans.find((p) => p.plan_id === plan.id)}
                  canManage={canManagePayouts}
                  onBreakdown={() => setBreakdownPlan(plan)}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No active payout plans" hint="Completed and cancelled plans are under the buttons above" />
          )}
        </Panel>
      )}

      {tab === 'vaults' && (
        <Panel
          title="Vaults"
          flush
          action={
            vaults.length > 0 ? (
              <Link to="/vaults" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All vaults
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : undefined
          }
        >
          {vaults.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {vaults.map((vault: any) => (
                <VaultCard key={vault.id} vault={vault} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Vault} title="No vaults found" hint="User hasn't created any vaults yet" />
          )}
        </Panel>
      )}

      {tab === 'transactions' && (
        <Panel
          title="Transactions"
          subtitle="Most recent first"
          flush
          action={
            <Link
              to={`/users/${id}/transactions`}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              View all
            </Link>
          }
        >
          {transactions.length > 0 ? (
            <TransactionList items={transactions} onOpen={handleTransactionClick} attention={needsAttention} />
          ) : (
            transactionsEmpty
          )}
        </Panel>
      )}

      {tab === 'kyc' && <KycPanel kycData={kycData} kycProgress={kycProgress} tier={tier} />}

      {tab === 'activity' && (
        <Panel
          title="Activity"
          subtitle="Recent events for this user"
          flush
          action={
            events.length > 0 || (userActivity?.auditLogs?.length ?? 0) > 0 ? (
              <Link
                to={`/users/${id}/events`}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
              >
                View all
              </Link>
            ) : undefined
          }
        >
          {events.length > 0 ? <EventList events={events} /> : <EmptyState icon={Zap} title="No recent events" />}
        </Panel>
      )}

      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isTransactionModalOpen}
        onClose={handleCloseTransactionModal}
        showViewProfile={false}
      />
      {breakdownPlan && (
        <PlanBreakdownModal
          planId={breakdownPlan.id}
          planName={breakdownPlan.name}
          userName={fullName || user.email}
          onClose={() => setBreakdownPlan(null)}
        />
      )}
    </div>
  );
}
