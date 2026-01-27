import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface SenderEmail {
  id: string;
  email: string;
  display_name: string;
  is_default: boolean;
  is_active: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSenderEmails(includeInactive: boolean = false) {
  return useQuery({
    queryKey: ['sender-emails', includeInactive],
    queryFn: async () => {
      let query = supabase
        .from('sender_email_addresses')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return (data || []) as SenderEmail[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
