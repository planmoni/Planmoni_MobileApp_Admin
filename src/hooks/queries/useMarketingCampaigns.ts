import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface MarketingCampaign {
  id: string;
  title: string;
  subject: string;
  html_content: string;
  plain_text_content: string | null;
  category: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

async function fetchMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export function useMarketingCampaigns() {
  return useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: fetchMarketingCampaigns,
    staleTime: 30 * 1000,
  });
}

async function fetchCampaignStats(): Promise<{
  total_campaigns: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  avg_open_rate: number;
}> {
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('recipient_count, delivered_count, opened_count, status');

  if (error) throw error;

  const campaigns = data || [];
  const total_campaigns = campaigns.length;
  const sent_campaigns = campaigns.filter(c => c.status === 'sent');
  const total_sent = sent_campaigns.reduce((acc, c) => acc + (c.recipient_count || 0), 0);
  const total_delivered = sent_campaigns.reduce((acc, c) => acc + (c.delivered_count || 0), 0);
  const total_opened = sent_campaigns.reduce((acc, c) => acc + (c.opened_count || 0), 0);
  const avg_open_rate = total_delivered > 0 ? (total_opened / total_delivered) * 100 : 0;

  return {
    total_campaigns,
    total_sent,
    total_delivered,
    total_opened,
    avg_open_rate,
  };
}

export function useCampaignStats() {
  return useQuery({
    queryKey: ['campaign-stats'],
    queryFn: fetchCampaignStats,
    staleTime: 60 * 1000,
  });
}
