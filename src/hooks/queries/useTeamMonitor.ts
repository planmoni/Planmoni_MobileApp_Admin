import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type TeamRole = { role_id: string; role_name: string; role_color: string | null; role_level: number };

export type TeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  roles: TeamRole[];
  suspended: boolean;
  suspension: { reason: string; blocked_at: string; blocked_by: string | null } | null;
  status: 'online' | 'offline' | 'suspended';
  last_seen: string | null;
  active_sessions: number;
  last_page: string | null;
  last_page_at: string | null;
  last_action: string | null;
  last_action_at: string | null;
};

export type ActivityRow = {
  id: string;
  user_id: string;
  kind: 'page_view' | 'action' | 'login' | 'logout' | 'role' | 'access';
  action: string;
  path: string | null;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
};

export const TEAM_OVERVIEW_KEY = ['team-overview'] as const;
export const TEAM_FEED_KEY = ['team-feed'] as const;
export const FEED_PAGE_SIZE = 50;

export const memberName = (m: Pick<TeamMember, 'first_name' | 'last_name' | 'email'>) =>
  `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email || 'Unknown';

/** One row per admin or role holder: online status, last seen, current page and roles. Refreshes every 30 seconds. */
export function useTeamOverview(enabled = true) {
  return useQuery({
    queryKey: TEAM_OVERVIEW_KEY,
    enabled,
    staleTime: 0,
    refetchInterval: 30 * 1000,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase.rpc('admin_team_overview');
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });
}

/** Newest first. Older pages are loaded with the created_at of the last row seen. */
export function useActivityFeed(opts: { userId: string | null; kinds: string[] | null; enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: [...TEAM_FEED_KEY, opts.userId, opts.kinds?.join(',') ?? 'all'],
    enabled: opts.enabled ?? true,
    staleTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ActivityRow[]> => {
      const { data, error } = await supabase.rpc('admin_activity_feed', {
        p_limit: FEED_PAGE_SIZE,
        p_before: pageParam,
        p_user_id: opts.userId,
        p_kinds: opts.kinds,
      });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
    getNextPageParam: (last) => (last.length === FEED_PAGE_SIZE ? last[last.length - 1].created_at : undefined),
  });
}

export function useTeamControls() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: TEAM_OVERVIEW_KEY });
    queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['super-admin'] });
  };

  const forceLogout = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('admin_force_logout', { p_user_id: userId });
      if (error) throw error;
      return data as { sessions_closed: number };
    },
    onSuccess: refresh,
  });

  const removeRole = useMutation({
    mutationFn: async (input: { userId: string; roleId: string; signOut: boolean }) => {
      const { data, error } = await supabase.rpc('admin_remove_role', {
        p_user_id: input.userId,
        p_role_id: input.roleId,
        p_force_logout: input.signOut,
      });
      if (error) throw error;
      return data as { role_name: string };
    },
    onSuccess: refresh,
  });

  const suspend = useMutation({
    mutationFn: async (input: { userId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('admin_suspend', { p_user_id: input.userId, p_reason: input.reason });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  const unsuspend = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('admin_unsuspend', { p_user_id: userId });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });

  return { forceLogout, removeRole, suspend, unsuspend };
}
