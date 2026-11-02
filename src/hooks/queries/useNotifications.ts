import { logAdminAction } from '@/lib/adminActivity';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data: Record<string, any>;
  target_type: 'all' | 'individual' | 'segment';
  target_user_ids: string[];
  target_segment_id: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'failed' | 'cancelled';
  scheduled_for: string | null;
  sent_at: string | null;
  total_recipients: number;
  delivered_count: number;
  failed_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  notification_type?: string;
  notification_category?: string;
  queue_enabled?: boolean;
  rate_per_minute?: number;
  respect_marketing_pref?: boolean;
  personalize?: boolean;
  error?: string | null;
}

export interface NotificationDispatchLog {
  id: string;
  push_notification_id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  notification_title: string;
  notification_body: string;
  notification_type: string;
  notification_category: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  delivered_at: string | null;
  created_at: string;
}

export interface ReengagementUser {
  user_id: string;
  email: string;
  full_name: string;
  [key: string]: any;
}

export interface ReengagementStats {
  category: string;
  eligible_count: number;
}

export interface PushNotificationSegment {
  id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, any>;
  user_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_pending: number;
  delivery_rate: number;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['push-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;
      return data as PushNotification[];
    },
    // keep the history live while something is being sent
    refetchInterval: (query) =>
      (query.state.data as PushNotification[] | undefined)?.some((n) => n.status === 'sending' || n.status === 'paused') ? 5000 : false,
  });
}

export function useNotificationSegments() {
  return useQuery({
    queryKey: ['push-notification-segments'],
    queryFn: async () => {
      // First, update segment counts to ensure they're accurate
      const { error: updateError } = await supabase.rpc('update_all_segment_user_counts');
      if (updateError) {
        console.warn('Error updating segment counts (non-critical):', updateError);
      }

      // Then fetch segments with updated counts
      const { data, error } = await supabase
        .from('push_notification_segments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Calculate "All Users" count separately (users with active push tokens)
      const { count: allUsersCount } = await supabase
        .from('user_push_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      // Update "All Users" segment count if it exists
      const allUsersSegment = data?.find(s => s.filter_criteria?.type === 'all');
      if (allUsersSegment && allUsersCount !== undefined) {
        allUsersSegment.user_count = allUsersCount;
      }
      
      return data as PushNotificationSegment[];
    },
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_notifications')
        .select('status, delivered_count, failed_count');

      if (error) throw error;

      const stats: NotificationStats = {
        total_sent: 0,
        total_delivered: 0,
        total_failed: 0,
        total_pending: 0,
        delivery_rate: 0,
      };

      if (!data) return stats;

      data.forEach((notification) => {
        if (notification.status === 'sent') stats.total_sent++;
        if (['draft', 'scheduled', 'sending', 'paused'].includes(notification.status)) stats.total_pending++;
        // delivered_count = devices Expo accepted (or confirmed), also for sends still in progress
        stats.total_delivered += notification.delivered_count || 0;
        stats.total_failed += notification.failed_count || 0;
      });

      const attempted = stats.total_delivered + stats.total_failed;
      if (attempted > 0) {
        stats.delivery_rate = Math.round((stats.total_delivered / attempted) * 100);
      }

      return stats;
    },
  });
}

export function useUserPushTokens() {
  return useQuery({
    queryKey: ['user-push-tokens'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_push_tokens')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export interface DispatchFilters {
  status?: string;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useNotificationDispatchLogs(
  limit: number = 100,
  offset: number = 0,
  filters: DispatchFilters = {}
) {
  return useQuery({
    queryKey: ['notification-dispatch-logs', limit, offset, filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_notification_dispatch_logs', {
        limit_count: limit,
        offset_count: offset,
        filter_status: filters.status || null,
        filter_category: filters.category || null,
        search_term: filters.search || null,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
      });

      if (error) throw error;
      return data as NotificationDispatchLog[];
    },
    refetchInterval: 10000,
  });
}

export function useReengagementStats() {
  return useQuery({
    queryKey: ['reengagement-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_reengagement_stats');

      if (error) throw error;
      return data as ReengagementStats[];
    },
    refetchInterval: 30000,
  });
}

export function useReengagementUsers(category: string, enabled: boolean = false) {
  return useQuery({
    queryKey: ['reengagement-users', category],
    queryFn: async () => {
      let rpcFunction = '';
      switch (category) {
        case 'zero_balance_reminder':
          rpcFunction = 'get_zero_balance_users';
          break;
        case 'vault_unfunded_reminder':
          rpcFunction = 'get_unfunded_vault_users';
          break;
        case 'deposit_no_plan':
          rpcFunction = 'get_deposit_no_plan_users';
          break;
        case 'no_plan_yet':
          rpcFunction = 'get_no_plan_users';
          break;
        case 're_engagement':
          rpcFunction = 'get_inactive_users';
          break;
        default:
          throw new Error('Invalid reengagement category');
      }

      const { data, error } = await supabase.rpc(rpcFunction);

      if (error) throw error;
      return data as ReengagementUser[];
    },
    enabled,
  });
}

export interface DispatchStats {
  total_dispatched: number;
  total_delivered: number;
  total_accepted: number;
  total_failed: number;
  success_rate: number;
  avg_delivery_time: number;
}

// Counted in the database (today, Lagos time) instead of reading log rows through the 1000-row REST limit.
export function useDispatchStats() {
  return useQuery({
    queryKey: ['dispatch-stats'],
    queryFn: async (): Promise<DispatchStats> => {
      const { data, error } = await supabase.rpc('admin_push_dispatch_stats');
      if (error) throw error;

      const total = Number(data?.total_dispatched) || 0;
      const delivered = Number(data?.total_delivered) || 0;
      const accepted = Number(data?.total_accepted) || 0;
      return {
        total_dispatched: total,
        total_delivered: delivered,
        total_accepted: accepted,
        total_failed: Number(data?.total_failed) || 0,
        // accepted by Expo or confirmed delivered, out of everything attempted
        success_rate: total > 0 ? Math.round(((delivered + accepted) / total) * 100) : 0,
        avg_delivery_time: Number(data?.avg_delivery_time) || 0,
      };
    },
    refetchInterval: 30000,
  });
}

export interface AudiencePreview {
  users: number;
  devices: number;
  opted_out_users: number;
  devices_over_cap: number;
  users_with_device: number;
}

export interface AudienceParams {
  targetType: 'all' | 'individual' | 'segment';
  segmentId?: string;
  respectMarketing: boolean;
}

/** Who a send would reach, counted by the same SQL that builds the queue. */
export function useAudiencePreview(params: AudienceParams, enabled: boolean) {
  const ready = enabled && (params.targetType !== 'segment' || !!params.segmentId);
  return useQuery({
    queryKey: ['push-audience-preview', params.targetType, params.segmentId ?? null, params.respectMarketing],
    queryFn: async (): Promise<AudiencePreview> => {
      const { data, error } = await supabase.rpc('admin_push_audience_preview', {
        p_target_type: params.targetType,
        p_segment_id: params.targetType === 'segment' ? params.segmentId : null,
        p_user_ids: null,
        p_respect_marketing: params.respectMarketing,
        p_max_tokens: 3,
      });
      if (error) throw error;
      return data as AudiencePreview;
    },
    enabled: ready,
    staleTime: 15000,
    retry: false,
  });
}

export interface PushProgress {
  id: string;
  status: PushNotification['status'];
  queued: boolean;
  total: number;
  counts: Record<string, number>;
  remaining: number;
  /** failed devices that can still be retried (their token is still active) */
  retryable: number;
  /** failed devices whose app was removed or token expired; they can never be reached */
  unreachable: number;
  rate_per_minute: number;
  eta_seconds: number | null;
}

export function usePushProgress(notificationId: string, enabled: boolean, live = true) {
  return useQuery({
    queryKey: ['push-progress', notificationId],
    queryFn: async (): Promise<PushProgress> => {
      const { data, error } = await supabase.rpc('admin_push_progress', { p_notification_id: notificationId });
      if (error) throw error;
      return data as PushProgress;
    },
    enabled,
    refetchInterval: live ? 5000 : false,
  });
}

export type PushControlAction = 'pause' | 'resume' | 'cancel' | 'retry_failed';

export function usePushControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: PushControlAction }) => {
      const { data, error } = await supabase.rpc(`admin_push_${action}`, { p_notification_id: id });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: (_data, { id, action }) => {
      const labels: Record<PushControlAction, string> = {
        pause: 'Paused a push send',
        resume: 'Resumed a push send',
        cancel: 'Cancelled a push send',
        retry_failed: 'Retried failed push deliveries',
      };
      void logAdminAction(labels[action], { id });
      queryClient.invalidateQueries({ queryKey: ['push-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['push-progress'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
    },
  });
}
