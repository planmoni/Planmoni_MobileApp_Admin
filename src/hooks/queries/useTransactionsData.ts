import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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

interface TransactionStats {
  total_deposits: number;
  total_payouts: number;
  total_withdrawals: number;
}

interface TransactionsQueryParams {
  searchQuery?: string;
  activeType?: TransactionType;
  dateRange?: { start: Date | null; end: Date | null };
}

const fetchTransactionsData = async (params: TransactionsQueryParams = {}) => {
  const { searchQuery = '', activeType = 'all', dateRange } = params;
  
  try {
    // Use the optimized RPC function for fetching transactions
    const { data: transactionData, error: transactionError } = await supabase.rpc('get_all_transactions_data', {
      search_query: searchQuery || null,
      transaction_type: activeType === 'all' ? null : activeType,
      start_date: dateRange?.start ? format(dateRange.start, 'yyyy-MM-dd') : null,
      end_date: dateRange?.end ? format(dateRange.end, 'yyyy-MM-dd') : null,
      limit_count: 100,
      offset_count: 0
    });
    
    if (transactionError) {
      console.error('Error fetching transactions via RPC:', transactionError);
      // Fallback to original method
      return await fetchTransactionsDataFallback(params);
    }
    
    // Transform the data to match expected format
    const transformedTransactions: Transaction[] = transactionData?.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      source: t.source,
      destination: t.destination,
      reference: t.reference,
      description: t.description,
      payout_plan_id: t.payout_plan_id,
      bank_account_id: t.bank_account_id,
      created_at: t.created_at,
      profiles: [{
        id: '',
        first_name: t.user_name?.split(' ')[0] || null,
        last_name: t.user_name?.split(' ')[1] || null,
        email: t.user_email
      }]
    })) || [];
    
    // Fetch transaction statistics
    const { data: statsData, error: statsError } = await supabase.rpc('get_transaction_stats', {
      start_date: dateRange?.start ? format(dateRange.start, 'yyyy-MM-dd') : null,
      end_date: dateRange?.end ? format(dateRange.end, 'yyyy-MM-dd') : null
    });
    
    let stats = { inflows: 0, outflows: 0, netMovement: 0 };
    
    if (!statsError && statsData && statsData.length > 0) {
      const statsInfo = statsData[0] as TransactionStats;
      stats = {
        inflows: statsInfo.total_deposits || 0,
        outflows: (statsInfo.total_payouts || 0) + (statsInfo.total_withdrawals || 0),
        netMovement: (statsInfo.total_deposits || 0) - ((statsInfo.total_payouts || 0) + (statsInfo.total_withdrawals || 0)),
      };
    }
    
    return {
      transactions: transformedTransactions,
      stats
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return await fetchTransactionsDataFallback(params);
  }
};

const fetchTransactionsDataFallback = async (params: TransactionsQueryParams = {}) => {
  const { searchQuery = '', activeType = 'all', dateRange } = params;
  
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
  
  if (dateRange?.start && dateRange?.end) {
    filtered = filtered.filter(transaction => {
      const transactionDate = new Date(transaction.created_at);
      return transactionDate >= dateRange.start! && transactionDate <= dateRange.end!;
    });
  }
  
  // Calculate stats manually for fallback
  const inflows = filtered
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
  const outflows = filtered
    .filter(t => t.type === 'payout' || t.type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);
  
  return {
    transactions: filtered as Transaction[],
    stats: {
      inflows,
      outflows,
      netMovement: inflows - outflows,
    }
  };
};

export const useTransactionsData = (params: TransactionsQueryParams = {}) => {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => fetchTransactionsData(params),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};