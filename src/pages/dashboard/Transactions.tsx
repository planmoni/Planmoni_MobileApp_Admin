import { useState } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import DateRangePicker from '../../components/DateRangePicker';
import TransactionDetailsModal from '../../components/TransactionDetailsModal';
import { format } from 'date-fns';
import { useTransactionsData } from '@/hooks/queries/useTransactionsData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

type TransactionType = 'all' | 'deposit' | 'payout' | 'withdrawal';

export default function Transactions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<TransactionType>('all');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: transactionsData, isLoading, error } = useTransactionsData({
    searchQuery,
    activeType,
    dateRange
  });

  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['transactions']);
  };

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
  };

  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  const groupTransactionsByDate = () => {
    if (!transactionsData?.transactions) return {};

    const grouped: Record<string, any[]> = {};

    transactionsData.transactions.forEach(transaction => {
      const date = format(new Date(transaction.created_at), 'yyyy-MM-dd');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(transaction);
    });

    return grouped;
  };

  const groupedTransactions = groupTransactionsByDate();

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load transactions</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const stats = transactionsData?.stats || { inflows: 0, outflows: 0, netMovement: 0 };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Transactions</h1>
          <p className="text-gray-500">View and manage all transactions</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
          />
        </div>
        <button className="inline-flex items-center px-5 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all">
          <Filter className="h-5 w-5 mr-2" />
          Filter
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex overflow-x-auto pb-2 space-x-2">
          <button
            onClick={() => setActiveType('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeType === 'all'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveType('deposit')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeType === 'deposit'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Deposits
          </button>
          <button
            onClick={() => setActiveType('payout')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeType === 'payout'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Payouts
          </button>
          <button
            onClick={() => setActiveType('withdrawal')}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeType === 'withdrawal'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Withdrawals
          </button>
        </div>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={handleDateRangeChange}
          placeholder="Select date range"
          className="w-full sm:w-auto"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 mb-8 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Total Inflows</p>
            <p className="text-2xl font-bold text-green-600">₦{stats.inflows.toLocaleString()}</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Total Outflows</p>
            <p className="text-2xl font-bold text-red-600">₦{stats.outflows.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Net Movement</p>
            <p className={`text-2xl font-bold ${
              stats.netMovement >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ₦{stats.netMovement.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
        </div>
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-12 text-center">
          <p className="text-gray-500">
            {searchQuery || activeType !== 'all' ? 'No transactions match your filters' : 'No transactions found'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, transactions]) => {
            const formattedDate = format(new Date(date), 'MMMM d, yyyy');
            const isToday = new Date(date).toDateString() === new Date().toDateString();
            const isYesterday = new Date(date).toDateString() === new Date(Date.now() - 86400000).toDateString();

            const displayDate = isToday ? 'Today' : isYesterday ? 'Yesterday' : formattedDate;

            return (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-500 mb-3">{displayDate}</h3>
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
                  <div>
                    {transactions.map((transaction, index) => {
                      const isPositive = transaction.type === 'deposit';
                      return (
                        <div
                          key={transaction.id}
                          onClick={() => handleTransactionClick(transaction)}
                          className={`flex justify-between items-center p-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                            index !== transactions.length - 1 ? 'border-b border-gray-100' : ''
                          }`}
                        >
                          <div className="flex items-center">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                              isPositive ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                              {isPositive ? (
                                <ArrowUpRight className="h-5 w-5 text-green-600" />
                              ) : (
                                <ArrowDownRight className="h-5 w-5 text-red-600" />
                              )}
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-semibold text-gray-900">
                                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(transaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <p className={`text-sm font-semibold ${
                            isPositive ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isPositive ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
