import { useState } from 'react';
import { Lock, Repeat } from 'lucide-react';
import { getPayoutPlanIcon, getVaultIcon } from '@/lib/planIcons';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { box: string; icon: string }> = {
  sm: { box: 'w-9 h-9 p-1.5', icon: 'h-4 w-4' },
  md: { box: 'w-11 h-11 p-2', icon: 'h-5 w-5' },
  lg: { box: 'w-14 h-14 p-2.5', icon: 'h-6 w-6' },
};

function IconTile({
  src,
  alt,
  size,
  Fallback,
}: {
  src: string | null;
  alt: string;
  size: Size;
  Fallback: typeof Repeat;
}) {
  const [failed, setFailed] = useState(false);
  const dims = SIZES[size];

  if (src && !failed) {
    return (
      <div className={`${dims.box} rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0`}>
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className={`${dims.box} rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0`}>
      <Fallback className={`${dims.icon} text-gray-400`} />
    </div>
  );
}

export function PayoutPlanIcon({
  purpose,
  name,
  size = 'md',
}: {
  purpose?: string | null;
  name?: string | null;
  size?: Size;
}) {
  return <IconTile src={getPayoutPlanIcon(purpose, name)} alt={name || 'Payout plan'} size={size} Fallback={Repeat} />;
}

export function VaultIcon({
  categories,
  subcategories,
  name,
  size = 'md',
}: {
  categories?: unknown;
  subcategories?: unknown;
  name?: string | null;
  size?: Size;
}) {
  return (
    <IconTile
      src={getVaultIcon(categories, subcategories, name)}
      alt={name || 'Vault'}
      size={size}
      Fallback={Lock}
    />
  );
}
