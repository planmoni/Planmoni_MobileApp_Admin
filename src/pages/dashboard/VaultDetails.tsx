import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, User, Calendar, DollarSign, TrendingUp, TrendingDown, Clock, Repeat, CreditCard } from 'lucide-react';
import { useVaultDetails } from '@/hooks/queries/useVaults';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { format } from 'date-fns';

export default function VaultDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useVaultDetails(id);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    if (id) {
      refreshData.mutate(['vault', id]);
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load vault details</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const { vault, transactions = [], topups = [], schedules = [] } = data || {};

  if (!vault) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Vault not found</p>
        <button
          onClick={() => navigate('/vaults')}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Back to Vaults
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700';
      case 'paused':
        return 'bg-yellow-50 text-yellow-700';
      case 'completed':
        return 'bg-blue-50 text-blue-700';
      case 'cancelled':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'manual_topup':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'withdrawal':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'spending':
        return <DollarSign className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/vaults')}
            className="p-2 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{vault.name}</h1>
            <p className="text-gray-500">Vault Details and Activity</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Vault Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Owner</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                    {vault.user?.first_name && vault.user?.last_name ? (
                      <span className="text-sm font-semibold">
                        {vault.user.first_name[0]}{vault.user.last_name[0]}
                      </span>
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {vault.user?.first_name} {vault.user?.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{vault.user?.email}</div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(vault.status)}`}>
                  <span className="capitalize">{vault.status}</span>
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Start Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {vault.start_date ? format(new Date(vault.start_date), 'MMM d, yyyy') : 'Not set'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">End Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {vault.end_date ? format(new Date(vault.end_date), 'MMM d, yyyy') : 'Not set'}
                  </span>
                </div>
              </div>

              {vault.plan_name && vault.plan_name !== vault.name && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Plan Name</p>
                  <p className="text-gray-900">{vault.plan_name}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Overview</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: 'NGN'
                  }).format(vault.total_budget || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: 'NGN'
                  }).format(vault.current_balance || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-orange-600">
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: 'NGN'
                  }).format((vault.total_budget || 0) - (vault.current_balance || 0))}
                </p>
              </div>
              {vault.wallet && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Wallet Balance</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: 'NGN'
                    }).format(vault.wallet.balance || 0)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {vault.auto_topup_enabled && (
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Auto Top-up Enabled</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-blue-700">Top-up Amount</p>
                  <p className="text-lg font-semibold text-blue-900">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: 'NGN'
                    }).format(vault.auto_topup_amount || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-700">Frequency</p>
                  <p className="text-lg font-semibold text-blue-900 capitalize">
                    {vault.auto_topup_frequency || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {schedules && schedules.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Scheduled Payouts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedules.map((schedule: any) => (
              <div key={schedule.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Repeat className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 capitalize">
                        {schedule.frequency.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {schedule.completed_payouts || 0} / {schedule.duration}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(schedule.status)}`}>
                    {schedule.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Payout Amount</span>
                    <span className="font-semibold text-gray-900">
                      {new Intl.NumberFormat('en-NG', {
                        style: 'currency',
                        currency: 'NGN'
                      }).format(schedule.payout_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Amount</span>
                    <span className="font-semibold text-gray-900">
                      {new Intl.NumberFormat('en-NG', {
                        style: 'currency',
                        currency: 'NGN'
                      }).format(schedule.total_amount || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fee</span>
                    <span className="font-semibold text-orange-600">
                      {new Intl.NumberFormat('en-NG', {
                        style: 'currency',
                        currency: 'NGN'
                      }).format(schedule.fee_amount || 0)}
                    </span>
                  </div>
                  {schedule.next_payout_date && (
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                      <span className="text-gray-500">Next Payout</span>
                      <span className="font-medium text-gray-900">
                        {format(new Date(schedule.next_payout_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  {schedule.payout_account && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Payout Account</p>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3 w-3 text-gray-400" />
                        <span className="text-xs font-medium text-gray-900">
                          {schedule.payout_account.bank_name} - {schedule.payout_account.account_number}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((schedule.completed_payouts || 0) / schedule.duration) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Funding History
          </h2>
          {topups && topups.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {topups.map((topup: any) => (
                <div key={topup.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN'
                        }).format(topup.amount || 0)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{topup.description || 'Top-up'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(topup.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    topup.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {topup.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No funding history</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Transaction Ledger
          </h2>
          {transactions && transactions.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {transactions.map((transaction: any) => (
                <div key={transaction.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN'
                        }).format(transaction.amount || 0)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">
                        {transaction.type.replace('_', ' ')}
                      </p>
                      {transaction.description && (
                        <p className="text-xs text-gray-400 mt-1">{transaction.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(transaction.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No transactions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
