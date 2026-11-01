import tier0 from '../../assets/images/0.svg';
import tier1 from '../../assets/images/1.svg';
import tier2 from '../../assets/images/2.svg';
import tier3 from '../../assets/images/3.svg';
import type { KycTier } from '@/hooks/queries/useKycData';

const icons: Record<KycTier, string> = {
  0: tier0, // unverified
  1: tier1,
  2: tier2,
  3: tier3,
};

export const tierLabel = (tier: KycTier) => (tier === 0 ? 'Unverified' : `Tier ${tier}`);

export function TierIcon({ tier, className = 'h-6 w-6' }: { tier: KycTier; className?: string }) {
  return (
    <img
      src={icons[tier] ?? icons[0]}
      alt={tierLabel(tier)}
      className={`${className} object-contain flex-shrink-0`}
      draggable={false}
    />
  );
}
