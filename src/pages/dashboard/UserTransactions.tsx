import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Filter, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function UserTransactions() {
  const { id } = useParams<{ id: string }>();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const refreshData = useRefreshData();

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_user_info', { target_user_id: id });

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('User not found');

      const userInfo = data[0];
      return {
        id: userInfo.id,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
        email: userInfo.email,
      };
    },
    enabled: !!id,
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['user-transactions', id, filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('type', filterType);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleRefresh = () => {
    if (id) {
      refreshData.mutate(['user-transactions', id, filterType, filterStatus]);
    }
  };

  const handleExport = () => {
    if (!transactions || transactions.length === 0) return;

    const csvHeaders = ['Date', 'Type', 'Amount', 'Status', 'Reference'];
    const csvRows = transactions.map((t: any) => [
      format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss'),
      t.type,
      t.amount,
      t.status,
      t.reference || ''
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-${id}-transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (userLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600 mb-4">User not found</h2>
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

  const totalDeposits = transactions
    .filter((t: any) => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const totalPayouts = transactions
    .filter((t: any) => t.type === 'payout' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link
            to={`/users/${id}`}
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Transactions for {userData.first_name} {userData.last_name}
            </h1>
            <p className="text-gray-500">{userData.email}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={!transactions || transactions.length === 0}
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
            disabled={refreshData.isPending}
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900">{transactions.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Filter className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Deposited</p>
              <p className="text-3xl font-bold text-green-600">₦{totalDeposits.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Paid Out</p>
              <p className="text-3xl font-bold text-red-600">₦{totalPayouts.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="payout">Payouts</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white text-gray-900"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {transactionsLoading ? (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : transactions.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {transactions.map((transaction: any) => (
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
                    {transaction.reference && (
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        Ref: {transaction.reference}
                      </p>
                    )}
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
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <Filter className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No transactions found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
