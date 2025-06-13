import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import Card from '../../components/Card';
import DateRangePicker from '../../components/DateRangePicker';
import { format } from 'date-fns';

type TransactionType = 'all' | 'deposit' | 'payout' | 'withdrawal';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  source: string;
  destination: string;
  payout_plan_id?: string | null;
  bank_account_id?: string | null;
  reference?: string | null;
  description?: string | null;
  created_at: string;
  profiles: Profile[] | null;
}

interface SupabaseRpcTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  source: string;
  destination: string;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

interface TransactionStats {
  total_deposits: number;
  total_payouts: number;
  total_withdrawals: number;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState<TransactionType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [stats, setStats] = useState({
    inflows: 0,
    outflows: 0,
    netMovement: 0,
  });

  useEffect(() => {
    fetchTransactions();
  }, [searchQuery, activeType, dateRange]);

  const fetchTransactions = async () => {
    try {
      setRefreshing(true);
      
      // Use the optimized RPC function for fetching transactions
      const { data: transactionData, error: transactionError } = await supabase.rpc('get_all_transactions_data', {
        search_query: searchQuery || null,
        transaction_type: activeType === 'all' ? null : activeType,
        start_date: dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : null,
        end_date: dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : null,
        limit_count: 100,
        offset_count: 0
      });
      
      if (transactionError) {
        console.error('Error fetching transactions via RPC:', transactionError);
        // Fallback to original method
        await fetchTransactionsFallback();
        return;
      }
      
      // Transform the data to match expected format
      const transformedTransactions: Transaction[] = (transactionData as SupabaseRpcTransaction[])?.map((t: SupabaseRpcTransaction) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        source: t.source,
        destination: t.destination,
        created_at: t.created_at,
        profiles: [{
          id: '', // RPC doesn't return user ID, but we need it for the interface
          first_name: t.user_name?.split(' ')[0] || null,
          last_name: t.user_name?.split(' ')[1] || null,
          email: t.user_email
        }]
      })) || [];
      
      setTransactions(transformedTransactions);
      
      // Fetch transaction statistics
      const { data: statsData, error: statsError } = await supabase.rpc('get_transaction_stats', {
        start_date: dateRange.start ? format(dateRange.start, 'yyyy-MM-dd') : null,
        end_date: dateRange.end ? format(dateRange.end, 'yyyy-MM-dd') : null
      });
      
      if (statsError) {
        console.error('Error fetching transaction stats:', statsError);
      } else if (statsData && statsData.length > 0) {
        const statsInfo = statsData[0] as TransactionStats;
        setStats({
          inflows: statsInfo.total_deposits || 0,
          outflows: (statsInfo.total_payouts || 0) + (statsInfo.total_withdrawals || 0),
          netMovement: (statsInfo.total_deposits || 0) - ((statsInfo.total_payouts || 0) + (statsInfo.total_withdrawals || 0)),
        });
      }
      
    } catch (error) {
      console.error('Error fetching transactions:', error);
      await fetchTransactionsFallback();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTransactionsFallback = async () => {
    try {
      // Fallback to original query method
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          amount,
          status,
          source,
          destination,
          payout_plan_id,
          bank_account_id,
          reference,
          description,
          created_at,
          profiles (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Apply filters manually for fallback
      let filtered = data || [];
      
      if (activeType !== 'all') {
        filtered = filtered.filter(transaction => transaction.type === activeType);
      }
      
      if (searchQuery) {
        filtered = filtered.filter(transaction => 
          transaction.profiles?.[0]?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.profiles?.[0]?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.profiles?.[0]?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
          transaction.destination.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      if (dateRange.start && dateRange.end) {
        filtered = filtered.filter(transaction => {
          const transactionDate = new Date(transaction.created_at);
          return transactionDate >= dateRange.start! && transactionDate <= dateRange.end!;
        });
      }
      
      setTransactions(filtered as Transaction[]);
      
      // Calculate stats manually for fallback
      const inflows = filtered
        .filter(t => t.type === 'deposit')
        .reduce((sum, t) => sum + t.amount, 0);
      const outflows = filtered
        .filter(t => t.type === 'payout' || t.type === 'withdrawal')
        .reduce((sum, t) => sum + t.amount, 0);
      
      setStats({
        inflows,
        outflows,
        netMovement: inflows - outflows,
      });
      
    } catch (error) {
      console.error('Error in fallback transactions fetch:', error);
    }
  };

  // Group transactions by date
  const groupTransactionsByDate = () => {
    const grouped: Record<string, Transaction[]> = {};
    
    transactions.forEach(transaction => {
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Transactions</h1>
          <p className="text-text-secondary dark:text-text-secondary">View and manage all transactions</p>
        </div>
        <button 
          onClick={fetchTransactions}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshing ? 'animate-spin' : ''}`} />
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