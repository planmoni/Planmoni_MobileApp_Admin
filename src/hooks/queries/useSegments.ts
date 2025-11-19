import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface CampaignSegment {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, any>;
  user_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

async function fetchSegments(): Promise<CampaignSegment[]> {
  const { data, error } = await supabase
    .from('campaign_segments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export function useSegments() {
  return useQuery({
    queryKey: ['campaign-segments'],
    queryFn: fetchSegments,
    staleTime: 60 * 1000,
  });
}
