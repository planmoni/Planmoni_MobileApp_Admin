import { useState } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import Card from '../../components/Card';
import DateRangePicker from '../../components/DateRangePicker';
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

  const { data: transactionsData, isLoading, error } = useTransactionsData({
    searchQuery,
    activeType,
    dateRange
  });

  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['transactions']);
  };

  // Group transactions by date
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

  const formatDateRange = () => {
    if (!dateRange.start || !dateRange.end) return 'All Time';
    
    return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load transactions</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          Try Again
        </button>
      </div>
    );
  }

  const stats = transactionsData?.stats || { inflows: 0, outflows: 0, netMovement: 0 };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Transactions</h1>
          <p className="text-text-secondary dark:text-text-secondary">View and manage all transactions</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-text-secondary dark:text-text-secondary" />
          </div>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light"
          />
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-surface text-text dark:text-text hover:bg-background-tertiary dark:hover:bg-background-tertiary focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light">
          <Filter className="h-5 w-5 mr-2" />
          Filter
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex overflow-x-auto pb-2 space-x-2">
          <button
            onClick={() => setActiveType('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeType === 'all'
                ? 'bg-primary text-white'
                : 'bg-background-tertiary dark:bg-background-tertiary text-text-secondary dark:text-text-secondary hover:bg-background-secondary dark:hover:bg-background-secondary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveType('deposit')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeType === 'deposit'
                ? 'bg-primary text-white'
                : 'bg-background-tertiary dark:bg-background-tertiary text-text-secondary dark:text-text-secondary hover:bg-background-secondary dark:hover:bg-background-secondary'
            }`}
          >
            Deposits
          </button>
          <button
            onClick={() => setActiveType('payout')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeType === 'payout'
                ? 'bg-primary text-white'
                : 'bg-background-tertiary dark:bg-background-tertiary text-text-secondary dark:text-text-secondary hover:bg-background-secondary dark:hover:bg-background-secondary'
            }`}
          >
            Payouts
          </button>
          <button
            onClick={() => setActiveType('withdrawal')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              activeType === 'withdrawal'
                ? 'bg-primary text-white'
                : 'bg-background-tertiary dark:bg-background-tertiary text-text-secondary dark:text-text-secondary hover:bg-background-secondary dark:hover:bg-background-secondary'
            }`}
          >
            Withdrawals
          </button>
        </div>
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={(start, end) => setDateRange({ start, end })}
          placeholder={formatDateRange()}
        />
      </div>

      <div className="bg-white dark:bg-surface rounded-lg shadow mb-6 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 p-4">
          <div className="text-center">
            <p className="text-sm text-text-secondary dark:text-text-secondary mb-1">Total Inflows</p>
            <p className="text-lg font-semibold text-success dark:text-success">₦{stats.inflows.toLocaleString()}</p>
          </div>
          <div className="text-center border-x border-border dark:border-border">
            <p className="text-sm text-text-secondary dark:text-text-secondary mb-1">Total Outflows</p>
            <p className="text-lg font-semibold text-error dark:text-error">₦{stats.outflows.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-text-secondary dark:text-text-secondary mb-1">Net Movement</p>
            <p className={`text-lg font-semibold ${
              stats.netMovement >= 0 ? 'text-success dark:text-success' : 'text-error dark:text-error'
            }`}>
              ₦{stats.netMovement.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : Object.keys(groupedTransactions).length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-text-secondary dark:text-text-secondary">
            {searchQuery || activeType !== 'all' ? 'No transactions match your filters' : 'No transactions found'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, transactions]) => {
            const formattedDate = format(new Date(date), 'MMMM d, yyyy');
            const isToday = new Date(date).toDateString() === new Date().toDateString();
            const isYesterday = new Date(date).toDateString() === new Date(Date.now() - 86400000).toDateString();
            
            const displayDate = isToday ? 'Today' : isYesterday ? 'Yesterday' : formattedDate;
            
            return (
              <div key={date}>
                <h3 className="text-sm font-semibold text-text-secondary dark:text-text-secondary mb-3">{displayDate}</h3>
                <Card className="overflow-hidden">
                  <div className="divide-y divide-border dark:divide-border">
                    {transactions.map((transaction) => {
                      const isPositive = transaction.type === 'deposit';
                      return (
                        <div key={transaction.id} className="flex justify-between items-center p-4 hover:bg-background-tertiary dark:hover:bg-background-tertiary/20 transition-colors">
                          <div className="flex items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isPositive ? 'bg-success-light dark:bg-success-light/20' : 'bg-error-light dark:bg-error-light/20'
                            }`}>
                              {isPositive ? (
                                <ArrowUpRight className="h-5 w-5 text-success dark:text-success" />
                              ) : (
                                <ArrowDownRight className="h-5 w-5 text-error dark:text-error" />
                              )}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-text dark:text-text">
                                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                              </p>
                              <p className="text-xs text-text-secondary dark:text-text-secondary">
                                {new Date(transaction.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <p className={`text-sm font-semibold ${
                            isPositive ? 'text-success dark:text-success' : 'text-error dark:text-error'
                          }`}>
                            {isPositive ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}