import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Calendar, Building2, ArrowUpRight, ArrowDownRight, RefreshCw, Shield, Lock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { useUserDetails } from '@/hooks/queries/useUsersData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: userDetailsData, isLoading, error } = useUserDetails(id!);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    if (id) {
      refreshData.mutate(['user', id]);
    }
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

  const { user, transactions, payoutPlans, bankAccounts } = userDetailsData;

  // Calculate user stats
  const totalDeposits = transactions
    .filter((t: any) => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const totalPayouts = transactions
    .filter((t: any) => t.type === 'payout' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  
  const activePlans = payoutPlans.filter((p: any) => p.status === 'active').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/users"
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">User Details</h1>
            <p className="text-gray-500">View and manage user information</p>
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

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-grey-500 to-grey-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
              {user.is_admin && (
                <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 flex items-center gap-1.5 border border-blue-100">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-1">{user.email}</p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Joined {format(new Date(user.created_at), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-gray-900">₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Deposits</p>
              <p className="text-3xl font-bold text-gray-900">₦{totalDeposits.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Payouts</p>
              <p className="text-3xl font-bold text-gray-900">₦{totalPayouts.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Active Plans</p>
              <p className="text-3xl font-bold text-gray-900">{activePlans}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Wallet Information</h2>
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Available Balance</p>
                    <p className="text-2xl font-bold text-gray-900">₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Locked Balance</p>
                    <p className="text-2xl font-bold text-gray-900">₦{user.wallets?.[0]?.locked_balance.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Balance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₦{((user.wallets?.[0]?.balance || 0) + (user.wallets?.[0]?.locked_balance || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payout Accounts</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {bankAccounts.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {bankAccounts.map((account: any) => (
                  <div key={account.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-base font-semibold text-gray-900">{account.bank_name}</p>
                          {account.is_default && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                              Default
                            </span>
                          )}
                          <span className={`ml-auto px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                            account.transfer_enabled
                              ? 'bg-green-50 text-green-600 border border-green-100'
                              : 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                          }`}>
                            {account.transfer_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-gray-900 text-sm font-mono mb-1">{account.account_number}</p>
                        <p className="text-gray-600 text-sm mb-2">{account.account_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Added {format(new Date(account.created_at), 'MMM d, yyyy')}</span>
                          {account.paystack_recipient_code && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{account.paystack_recipient_code}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No payout accounts added</p>
                <p className="text-gray-400 text-sm mt-1">User hasn't added any bank accounts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Payout Plans</h2>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
          {payoutPlans.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {payoutPlans.map((plan: any) => (
                <div key={plan.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      plan.status === 'active'
                        ? 'bg-green-50 text-green-600 border border-green-100'
                        : plan.status === 'paused'
                          ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                          : plan.status === 'completed'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-gray-50 text-gray-600 border border-gray-100'
                    }`}>
                      {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Total Amount</p>
                      <p className="text-base font-bold text-gray-900">₦{plan.total_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Payout Amount</p>
                      <p className="text-base font-bold text-gray-900">₦{plan.payout_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Frequency</p>
                      <p className="text-base font-bold text-gray-900">
                        {plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Progress</p>
                      <p className="text-base font-bold text-gray-900">{plan.completed_payouts}/{plan.duration}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{Math.round((plan.completed_payouts / plan.duration) * 100)}% complete</span>
                      <span>{plan.duration - plan.completed_payouts} remaining</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((plan.completed_payouts / plan.duration) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No payout plans found</p>
              <p className="text-gray-400 text-sm mt-1">User hasn't created any plans yet</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Transactions</h2>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
          {transactions.length > 0 ? (
            <>
              <div className="divide-y divide-gray-100">
                {transactions.slice(0, 5).map((transaction: any) => (
                  <div key={transaction.id} className="p-5 hover:bg-gray-50 transition-colors flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        transaction.type === 'deposit' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <ArrowUpRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-900 mb-1">
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-lg mt-1.5 ${
                          transaction.status === 'completed'
                            ? 'bg-green-50 text-green-600 border border-green-100'
                            : transaction.status === 'pending'
                              ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                              : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xl font-bold ${
                      transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              {transactions.length > 5 && (
                <div className="border-t border-gray-100 p-4 text-center bg-gray-50">
                  <button className="text-gray-900 hover:text-gray-700 text-sm font-semibold transition-colors">
                    View All {transactions.length} Transactions
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <ArrowUpRight className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No transactions found</p>
              <p className="text-gray-400 text-sm mt-1">User hasn't made any transactions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}