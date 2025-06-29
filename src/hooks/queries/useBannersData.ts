import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type Banner = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const fetchBanners = async (): Promise<Banner[]> => {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

export const useBannersData = () => {
  return useQuery({
    queryKey: ['banners'],
    queryFn: fetchBanners,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};