import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Some list queries (RPCs, joins) do not return payout_plans.purpose or
 * budget_plans.categories, which pick a plan's icon. These hooks fetch just those
 * columns for the plan ids on screen, so the icon works on every page without
 * touching the existing queries.
 */

const CHUNK = 100;

const uniqueIds = (ids: Array<string | null | undefined>): string[] =>
  Array.from(new Set(ids.filter((id): id is string => !!id))).sort();

const chunked = <T,>(items: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
};

/** payout plan id -> purpose */
export const usePayoutPlanPurposes = (planIds: Array<string | null | undefined>) => {
  const ids = uniqueIds(planIds);

  return useQuery({
    queryKey: ['plan-icons', 'payout', ids.join(',')],
    queryFn: async (): Promise<Record<string, string | null>> => {
      const map: Record<string, string | null> = {};
      const results = await Promise.all(
        chunked(ids).map((chunk) => supabase.from('payout_plans').select('id, purpose').in('id', chunk))
      );
      for (const { data, error } of results) {
        if (error) throw error;
        for (const row of data || []) map[row.id] = row.purpose ?? null;
      }
      return map;
    },
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export type VaultCategoryInfo = { categories: unknown; subcategories: unknown };

/** vault (budget plan) id -> categories / subcategories */
export const useVaultCategories = (vaultIds: Array<string | null | undefined>) => {
  const ids = uniqueIds(vaultIds);

  return useQuery({
    queryKey: ['plan-icons', 'vault', ids.join(',')],
    queryFn: async (): Promise<Record<string, VaultCategoryInfo>> => {
      const map: Record<string, VaultCategoryInfo> = {};
      const results = await Promise.all(
        chunked(ids).map((chunk) =>
          supabase.from('budget_plans').select('id, categories, subcategories').in('id', chunk)
        )
      );
      for (const { data, error } of results) {
        if (error) throw error;
        for (const row of data || []) {
          map[row.id] = { categories: row.categories, subcategories: row.subcategories };
        }
      }
      return map;
    },
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
