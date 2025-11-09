import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
      const { data, error } = await supabase
        .from('push_notification_segments')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
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
