import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data: Record<string, any>;
  target_type: 'all' | 'individual' | 'segment';
  target_user_ids: string[];
  target_segment_id: string | null;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PushNotification[];
    },
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
        .select('status, total_recipients, delivered_count, failed_count');

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
        if (notification.status === 'sent') {
          stats.total_sent++;
          stats.total_delivered += notification.delivered_count || 0;
          stats.total_failed += notification.failed_count || 0;
        } else if (['draft', 'scheduled', 'sending'].includes(notification.status)) {
          stats.total_pending++;
        }
      });

      const totalRecipients = data
        .filter(n => n.status === 'sent')
        .reduce((sum, n) => sum + (n.total_recipients || 0), 0);

      if (totalRecipients > 0) {
        stats.delivery_rate = Math.round((stats.total_delivered / totalRecipients) * 100);
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

export function useRealtimeDispatch(onNewDispatch?: (dispatch: NotificationDispatchLog) => void) {
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  useEffect(() => {
    if (!realtimeEnabled || !onNewDispatch) return;

    const channel = supabase
      .channel('notification-dispatch')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'push_notification_logs',
        },
        async (payload) => {
          const log = payload.new;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', log.user_id)
            .single();

          const { data: notificationData } = await supabase
            .from('push_notifications')
            .select('title, body, notification_type, notification_category')
            .eq('id', log.push_notification_id)
            .single();

          if (profileData && notificationData) {
            onNewDispatch({
              id: log.id,
              push_notification_id: log.push_notification_id,
              user_id: log.user_id,
              user_email: profileData.email,
              user_full_name: profileData.full_name,
              notification_title: notificationData.title,
              notification_body: notificationData.body,
              notification_type: notificationData.notification_type,
              notification_category: notificationData.notification_category,
              status: log.status,
              error_message: log.error_message,
              sent_at: log.sent_at,
              delivered_at: log.delivered_at,
              created_at: log.created_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeEnabled, onNewDispatch]);

  return { realtimeEnabled, setRealtimeEnabled };
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

export function useDispatchStats() {
  return useQuery({
    queryKey: ['dispatch-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('push_notification_logs')
        .select('status, sent_at, delivered_at')
        .gte('sent_at', today.toISOString());

      if (error) throw error;

      const stats = {
        total_dispatched: data?.length || 0,
        total_delivered: data?.filter(d => d.status === 'delivered').length || 0,
        total_failed: data?.filter(d => d.status === 'failed').length || 0,
        success_rate: 0,
        avg_delivery_time: 0,
      };

      if (stats.total_dispatched > 0) {
        stats.success_rate = Math.round((stats.total_delivered / stats.total_dispatched) * 100);
      }

      const deliveredLogs = data?.filter(d => d.delivered_at && d.sent_at) || [];
      if (deliveredLogs.length > 0) {
        const totalTime = deliveredLogs.reduce((sum, log) => {
          const sentTime = new Date(log.sent_at!).getTime();
          const deliveredTime = new Date(log.delivered_at!).getTime();
          return sum + (deliveredTime - sentTime);
        }, 0);
        stats.avg_delivery_time = Math.round(totalTime / deliveredLogs.length / 1000);
      }

      return stats;
    },
    refetchInterval: 30000,
  });
}
