import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type KycTier = 0 | 1 | 2 | 3;
export type KycReviewStatus = 'pending' | 'approved' | 'rejected' | 'not_submitted';

/** Light row returned by the admin_list_kyc RPC (no document bodies, no raw BVN/NIN). */
export interface KycListRow {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  state: string | null;
  has_bvn: boolean;
  has_nin: boolean;
  document_type: { document_name?: string } | string | null;
  has_selfie: boolean;
  has_document_front: boolean;
  has_document_back: boolean;
  has_utility_bill: boolean;
  has_house_photo: boolean;
  review_status: KycReviewStatus | null;
  bill_type_label: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  bvn_review_status: KycReviewStatus | null;
  bvn_submitted_at: string | null;
  bvn_reviewed_at: string | null;
  bvn_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  tier: KycTier;
  current_step: string | null;
  liveness_done: boolean;
  bvn_verified: boolean;
  id_face_verified: boolean;
  personal_info_completed: boolean;
  documents_verified: boolean;
  address_completed: boolean;
  utility_bill_verified: boolean;
}

export interface KycTierStats {
  total: number;
  tier0: number;
  tier1: number;
  tier2: number;
  tier3: number;
  tier3_pending: number;
  tier3_rejected: number;
  tier1_bvn_pending: number;
  tier1_bvn_rejected: number;
}

export interface KycListFilters {
  search?: string;
  tier?: KycTier | null;
  /** 'none' = never submitted Tier 3 documents */
  reviewStatus?: KycReviewStatus | 'none' | null;
  /** 'none' = never requested Tier 1 BVN face review */
  bvnReviewStatus?: KycReviewStatus | 'none' | null;
  page?: number;
  pageSize?: number;
}

export interface KycListResult {
  rows: KycListRow[];
  total: number;
}

/** Full kyc_data row as returned by admin_get_kyc_detail. */
export interface KycDetailRecord {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address: string | null;
  address_no: string | null;
  lga: string | null;
  state: string | null;
  bvn: string | null;
  nin: string | null;
  document_type: { document_name?: string; document_country_name?: string } | string | null;
  document_number: string | null;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  utility_bill_url: string | null;
  house_url: string | null;
  bank_name: string | null;
  account_number: string | null;
  approved: boolean | null;
  utility_bill_verified: boolean | null;
  utility_bill_validated: boolean | null;
  utility_bill_validation_result: {
    bill_type?: string;
    bill_type_label?: string;
    submitted_at?: string;
  } | null;
  utility_bill_review_status: KycReviewStatus | null;
  utility_bill_reviewed_by: string | null;
  utility_bill_reviewed_at: string | null;
  utility_bill_rejection_reason: string | null;
  bvn_face_review_status: KycReviewStatus | null;
  bvn_face_review_submitted_at: string | null;
  bvn_face_reviewed_by: string | null;
  bvn_face_reviewed_at: string | null;
  bvn_face_rejection_reason: string | null;
  bvn_face_review_note: string | null;
  bvn_face_review_selfie_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycDetail {
  kyc: KycDetailRecord;
  progress: {
    current_step: string | null;
    liveness_test_completed: boolean | null;
    bvn_verified: boolean | null;
    id_face_verified: boolean | null;
    personal_info_completed: boolean | null;
    documents_verified: boolean | null;
    address_completed: boolean | null;
    utility_bill_verified: boolean | null;
    tier_1_completed: boolean | null;
    tier_2_completed: boolean | null;
    tier_3_completed: boolean | null;
  } | null;
  email: string | null;
  tier: KycTier;
  reviewer_name: string | null;
  bvn_reviewer_name: string | null;
}

export const KYC_PAGE_SIZE = 25;

const KYC_QUERY_KEYS = ['kyc-data', 'kyc-tier-stats', 'kyc-tier3-queue', 'kyc-tier1-bvn-queue', 'dashboard'] as const;

export function useKycData(filters: KycListFilters = {}) {
  const {
    search = '',
    tier = null,
    reviewStatus = null,
    bvnReviewStatus = null,
    page = 0,
    pageSize = KYC_PAGE_SIZE,
  } = filters;

  return useQuery({
    queryKey: ['kyc-data', 'list', search, tier, reviewStatus, bvnReviewStatus, page, pageSize],
    queryFn: async (): Promise<KycListResult> => {
      const { data, error } = await supabase.rpc('admin_list_kyc', {
        p_search: search.trim() || null,
        p_tier: tier,
        p_review_status: reviewStatus,
        p_bvn_review_status: bvnReviewStatus,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });

      if (error) throw error;

      return {
        rows: (data?.rows ?? []) as KycListRow[],
        total: Number(data?.total ?? 0),
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useKycTierStats(enabled = true) {
  return useQuery({
    queryKey: ['kyc-tier-stats'],
    queryFn: async (): Promise<KycTierStats> => {
      const { data, error } = await supabase.rpc('admin_kyc_tier_stats');
      if (error) throw error;

      const stats = (data ?? {}) as Partial<KycTierStats>;
      return {
        total: Number(stats.total ?? 0),
        tier0: Number(stats.tier0 ?? 0),
        tier1: Number(stats.tier1 ?? 0),
        tier2: Number(stats.tier2 ?? 0),
        tier3: Number(stats.tier3 ?? 0),
        tier3_pending: Number(stats.tier3_pending ?? 0),
        tier3_rejected: Number(stats.tier3_rejected ?? 0),
        tier1_bvn_pending: Number(stats.tier1_bvn_pending ?? 0),
        tier1_bvn_rejected: Number(stats.tier1_bvn_rejected ?? 0),
      };
    },
    enabled,
    staleTime: 60 * 1000,
  });
}

export interface KycCompletedRow {
  user_id: string;
  tier: 1 | 2 | 3;
  completed_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface KycCompleted {
  total: number;
  tier1: number;
  tier2: number;
  tier3: number;
  rows: KycCompletedRow[];
}

/** Tier 1 / 2 / 3 completions since local midnight (counts per tier plus the latest ones), for the dashboard. */
export function useKycCompletedToday(limit = 6, enabled = true) {
  return useQuery({
    // starts with 'dashboard' so the dashboard's refresh button and Tier 3 reviews reload it
    queryKey: ['dashboard', 'kyc-completed-today', limit],
    queryFn: async (): Promise<KycCompleted> => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const { data, error } = await supabase.rpc('admin_kyc_completed', {
        p_from: start.toISOString(),
        p_to: null,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);

      const r = (data ?? {}) as Partial<KycCompleted>;
      return {
        total: Number(r.total ?? 0),
        tier1: Number(r.tier1 ?? 0),
        tier2: Number(r.tier2 ?? 0),
        tier3: Number(r.tier3 ?? 0),
        rows: (r.rows ?? []) as KycCompletedRow[],
      };
    },
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** Oldest-first queue of users awaiting Tier 3 manual review. */
export function useTier3Queue(limit = 8, enabled = true) {
  return useQuery({
    queryKey: ['kyc-tier3-queue', limit],
    queryFn: async (): Promise<KycListResult> => {
      const { data, error } = await supabase.rpc('admin_list_kyc', {
        p_search: null,
        p_tier: null,
        p_review_status: 'pending',
        p_bvn_review_status: null,
        p_limit: limit,
        p_offset: 0,
      });

      if (error) throw error;

      return {
        rows: (data?.rows ?? []) as KycListRow[],
        total: Number(data?.total ?? 0),
      };
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

/** Oldest-first queue of users awaiting Tier 1 BVN face-mismatch review. */
export function useTier1BvnQueue(limit = 8, enabled = true) {
  return useQuery({
    queryKey: ['kyc-tier1-bvn-queue', limit],
    queryFn: async (): Promise<KycListResult> => {
      const { data, error } = await supabase.rpc('admin_list_kyc', {
        p_search: null,
        p_tier: null,
        p_review_status: null,
        p_bvn_review_status: 'pending',
        p_limit: limit,
        p_offset: 0,
      });

      if (error) throw error;

      return {
        rows: (data?.rows ?? []) as KycListRow[],
        total: Number(data?.total ?? 0),
      };
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useKycDetail(userId: string | null) {
  return useQuery({
    queryKey: ['kyc-data', 'detail', userId],
    queryFn: async (): Promise<KycDetail | null> => {
      const { data, error } = await supabase.rpc('admin_get_kyc_detail', { p_user_id: userId });
      if (error) throw error;
      return (data as KycDetail | null) ?? null;
    },
    enabled: !!userId,
    staleTime: 0,
  });
}

export function useReviewTier3() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { activity: 'Reviewed a Tier 3 KYC submission' },
    mutationFn: async ({
      userId,
      decision,
      reason,
    }: {
      userId: string;
      decision: 'approve' | 'reject';
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_review_tier3', {
        p_user_id: userId,
        p_decision: decision,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return data as { user_id: string; decision: string; review_status: KycReviewStatus; tier: number };
    },
    onSuccess: async (data, vars) => {
      // Update the open drawer immediately so Approve/Reject hide without waiting on refetch
      queryClient.setQueryData<KycDetail | null>(['kyc-data', 'detail', vars.userId], (old) => {
        if (!old?.kyc) return old;
        return {
          ...old,
          tier: (data.tier ?? old.tier) as KycTier,
          kyc: {
            ...old.kyc,
            utility_bill_review_status: data.review_status,
            utility_bill_rejection_reason:
              vars.decision === 'reject' ? vars.reason?.trim() || old.kyc.utility_bill_rejection_reason : null,
            utility_bill_reviewed_at: new Date().toISOString(),
          },
        };
      });
      await Promise.all(
        KYC_QUERY_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      );
    },
  });
}

export function useReviewTier1Bvn() {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { activity: 'Reviewed a Tier 1 BVN face mismatch' },
    mutationFn: async ({
      userId,
      decision,
      reason,
    }: {
      userId: string;
      decision: 'approve' | 'reject';
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_review_tier1_bvn', {
        p_user_id: userId,
        p_decision: decision,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return data as { user_id: string; decision: string; review_status: KycReviewStatus; tier: number };
    },
    onSuccess: async (data, vars) => {
      queryClient.setQueryData<KycDetail | null>(['kyc-data', 'detail', vars.userId], (old) => {
        if (!old?.kyc) return old;
        return {
          ...old,
          tier: (data.tier ?? old.tier) as KycTier,
          kyc: {
            ...old.kyc,
            bvn_face_review_status: data.review_status,
            bvn_face_rejection_reason:
              vars.decision === 'reject' ? vars.reason?.trim() || old.kyc.bvn_face_rejection_reason : null,
            bvn_face_reviewed_at: new Date().toISOString(),
          },
          progress: old.progress
            ? {
                ...old.progress,
                bvn_verified: vars.decision === 'approve' ? true : old.progress.bvn_verified,
              }
            : old.progress,
        };
      });
      await Promise.all(
        KYC_QUERY_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      );
    },
  });
}
