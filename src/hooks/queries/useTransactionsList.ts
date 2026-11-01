import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TransactionItem, TransactionsPage } from '@/lib/transactionsView';

export const TRANSACTIONS_PAGE_SIZE = 25;

export type TransactionsListParams = {
  from: Date | null;
  /** exclusive */
  to: Date | null;
  type: string;
  status: string;
  search: string;
  userId: string | null;
  page: number; // 1-based
  pageSize?: number;
};

const fetchTransactions = async (p: TransactionsListParams): Promise<TransactionsPage> => {
  const pageSize = p.pageSize ?? TRANSACTIONS_PAGE_SIZE;
  const { data, error } = await supabase.rpc('admin_list_transactions', {
    p_from: p.from ? p.from.toISOString() : null,
    p_to: p.to ? p.to.toISOString() : null,
    p_type: p.type === 'all' ? null : p.type,
    p_status: p.status === 'all' ? null : p.status,
    p_search: p.search.trim() || null,
    p_user_id: p.userId,
    p_limit: pageSize,
    p_offset: (Math.max(p.page, 1) - 1) * pageSize,
  });

  if (error) throw new Error(error.message);

  const result = (data || {}) as Partial<TransactionsPage>;
  return {
    rows: result.rows || [],
    total: Number(result.total) || 0,
    facets: result.facets || [],
  };
};

/** One page of transactions, plus per type / per status totals for the whole filtered period. */
export const useTransactionsList = (params: TransactionsListParams) =>
  useQuery({
    // starts with 'transactions' so refresh buttons and payout actions that invalidate it reload this too
    queryKey: [
      'transactions',
      'list',
      {
        ...params,
        from: params.from?.toISOString() ?? null,
        to: params.to?.toISOString() ?? null,
      },
    ],
    queryFn: () => fetchTransactions(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/** Everything we know about one transaction: user, plan, destination account, failure reason, references. */
export const useTransactionDetail = (id: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: ['transactions', 'detail', id],
    enabled: enabled && !!id,
    queryFn: async (): Promise<TransactionItem | null> => {
      const { data, error } = await supabase.rpc('admin_get_transaction', { p_transaction_id: id });
      if (error) throw new Error(error.message);
      return (data as TransactionItem | null) ?? null;
    },
    staleTime: 15 * 1000,
  });
