import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface AppVersion {
  id: string;
  android_version: string;
  ios_version: string;
  android_build: number;
  ios_build: number;
  android_update_url: string | null;
  ios_update_url: string | null;
  update_message: string | null;
  force_update: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

async function fetchAppVersions(): Promise<AppVersion[]> {
  const { data, error } = await supabase
    .from('app_versions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export function useAppVersions() {
  return useQuery({
    queryKey: ['app-versions'],
    queryFn: fetchAppVersions,
    staleTime: 30 * 1000,
  });
}
