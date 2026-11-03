import { CheckCircle, Clock, XCircle } from 'lucide-react';
import type { KycReviewStatus, KycTier } from '@/hooks/queries/useKycData';
import { TierIcon } from '@/components/TierIcon';

const tierStyles: Record<KycTier, { label: string; className: string }> = {
  0: { label: 'Unverified', className: 'bg-gray-50 text-gray-500' },
  1: { label: 'Tier 1', className: 'bg-gray-100 text-gray-900' },
  2: { label: 'Tier 2', className: 'bg-gray-100 text-gray-900' },
  3: { label: 'Tier 3', className: 'bg-gray-100 text-gray-900' },
};

export function TierBadge({ tier, size = 'md' }: { tier: KycTier; size?: 'sm' | 'md' }) {
  const style = tierStyles[tier] ?? tierStyles[0];
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-3 py-1 text-sm gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-lg font-medium ${sizing} ${style.className}`}>
      <TierIcon tier={tier} className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      {style.label}
    </span>
  );
}

const reviewStyles: Record<
  Exclude<KycReviewStatus, 'not_submitted'>,
  { label: string; className: string; Icon: typeof Clock }
> = {
  pending: { label: 'Awaiting review', className: 'bg-gray-100 text-gray-700', Icon: Clock },
  approved: { label: 'Approved', className: 'bg-primary text-white', Icon: CheckCircle },
  rejected: { label: 'Rejected', className: 'bg-white text-gray-700 border border-gray-300', Icon: XCircle },
};

export function ReviewStatusBadge({ status }: { status: KycReviewStatus | string | null }) {
  // DB uses not_submitted (and older rows may still be null) for users who have not sent a bill
  if (!status || status === 'not_submitted') {
    return <span className="text-xs text-gray-400">Not submitted</span>;
  }

  const style = reviewStyles[status as keyof typeof reviewStyles];
  if (!style) {
    return <span className="text-xs text-gray-400 capitalize">{String(status).replace(/_/g, ' ')}</span>;
  }

  const { label, className, Icon } = style;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </span>
  );
}
