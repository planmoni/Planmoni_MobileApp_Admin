import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { getBankLogo } from '@/lib/bankLogos';
import { useToast } from '@/contexts/ToastContext';

export function BankLogo({
  bankName,
  bankCode,
  className = 'w-11 h-11',
  wideClassName = 'w-[4.5rem] h-11',
}: {
  bankName?: string | null;
  bankCode?: string | null;
  className?: string;
  /** tile size used when the logo is a wide wordmark that would be unreadable in a square tile */
  wideClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [wide, setWide] = useState(false);
  const logo = getBankLogo(bankName, bankCode);

  if (logo && !failed) {
    return (
      <div className={`${wide ? wideClassName : className} rounded-xl bg-white border border-gray-100 flex items-center justify-center p-2 shrink-0`}>
        <img
          src={logo}
          alt={bankName || 'Bank'}
          className="max-h-full max-w-full object-contain"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h && w / h > 2.2) setWide(true);
          }}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  const initials =
    (bankName || '?')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <div className={`${className} rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0`}>
      <span className="text-sm font-semibold text-gray-500">{initials}</span>
    </div>
  );
}

type BankAccountRowProps = {
  bankName?: string | null;
  bankCode?: string | null;
  accountNumber: string;
  accountName?: string | null;
  badges?: string[];
  footer?: ReactNode;
};

export default function BankAccountRow({
  bankName,
  bankCode,
  accountNumber,
  accountName,
  badges = [],
  footer,
}: BankAccountRowProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      showToast('Account number copied', 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Could not copy account number', 'error');
    }
  };

  return (
    <div className="p-4 md:p-5 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        <BankLogo bankName={bankName} bankCode={bankCode} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <p className="text-sm font-semibold text-gray-900">{bankName || 'Unknown bank'}</p>
            {badges.map((badge) => (
              <span
                key={badge}
                className="px-2 py-0.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700"
              >
                {badge}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-900 text-base font-mono font-semibold tracking-wide">{accountNumber}</p>
            <button
              onClick={copy}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Copy account number"
              title="Copy account number"
            >
              {copied ? <Check className="h-4 w-4 text-gray-900" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {accountName && <p className="text-gray-600 text-sm mb-2">{accountName}</p>}
          {footer && <div className="flex items-center gap-2 text-xs text-gray-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
