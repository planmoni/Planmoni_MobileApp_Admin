import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface AdminSearchUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  roles: {
    role_id: string;
    role_name: string;
    role_color: string;
    role_description?: string;
    role_level?: number;
  }[];
}

export interface AdminUserSearchResult {
  users: AdminSearchUser[];
  total: number;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Searches every user on the server (Super Admin only). An empty query returns the staff list:
 * admins and anyone holding an active role. Results are limited, so the match count is returned as well.
 */
export function useAdminUserSearch(query: string, options: { enabled?: boolean; limit?: number } = {}) {
  const { enabled = true, limit = 25 } = options;
  const debounced = useDebounced(query.trim(), 300);

  const result = useQuery({
    // starts with 'super-admin' so assigning roles refreshes these lists too
    queryKey: ['super-admin', 'user-search', debounced, limit],
    queryFn: async (): Promise<AdminUserSearchResult> => {
      const { data, error } = await supabase.rpc('admin_search_users', {
        p_query: debounced || null,
        p_only_staff: false,
        p_limit: limit,
      });
      if (error) throw error;
      return {
        users: ((data as any)?.users ?? []) as AdminSearchUser[],
        total: Number((data as any)?.total) || 0,
      };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    retry: false,
  });

  return {
    ...result,
    // true while the typed text has not been searched yet
    isTyping: query.trim() !== debounced,
    isSearching: debounced.length > 0,
  };
}
