import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  X,
  CheckCircle,
  XCircle,
  Circle,
  FileText,
  ExternalLink,
  ZoomIn,
  User as UserIcon,
  MapPin,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useKycDetail, useReviewTier3 } from '@/hooks/queries/useKycData';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useToast } from '@/contexts/ToastContext';
import { ReviewStatusBadge, TierBadge } from '@/components/KycBadges';

interface KycReviewDrawerProps {
  userId: string | null;
  onClose: () => void;
}

interface DocItem {
  key: string;
  label: string;
  url: string | null | undefined;
  tier3?: boolean;
}

const isPdf = (url: string) => /\.pdf(\?|#|$)/i.test(url) || url.startsWith('data:application/pdf');

const maskId = (value?: string | null) => {
  if (!value) return null;
  return value.length > 6 ? `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}` : value;
};

const formatDate = (value?: string | null, pattern = 'MMM d, yyyy h:mm a') => {
  if (!value) return '-';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '-' : format(date, pattern);
};

export default function KycReviewDrawer({ userId, onClose }: KycReviewDrawerProps) {
  const { data, isLoading, error } = useKycDetail(userId);
  const reviewMutation = useReviewTier3();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const canApprove = isSuperAdmin || hasPermission('kyc', 'approve');
  const canReject = isSuperAdmin || hasPermission('kyc', 'reject');

  // Reset local state whenever a different user is opened
  useEffect(() => {
    setMode(null);
    setReason('');
    setLightbox(null);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, lightbox, onClose]);

  if (!userId) return null;

  const kyc = data?.kyc;
  const progress = data?.progress;
  const tier = data?.tier ?? 0;
  const status = kyc?.utility_bill_review_status ?? null;
  const fullName = kyc ? [kyc.first_name, kyc.middle_name, kyc.last_name].filter(Boolean).join(' ') : '';
  const documentName =
    kyc && kyc.document_type && typeof kyc.document_type === 'object'
      ? kyc.document_type.document_name
      : (kyc?.document_type as string | null | undefined);

  const documents: DocItem[] = kyc
    ? [
        { key: 'utility', label: 'Proof of address (utility bill)', url: kyc.utility_bill_url, tier3: true },
        { key: 'house', label: 'House photo', url: kyc.house_url, tier3: true },
        { key: 'front', label: 'ID front', url: kyc.document_front_url },
        { key: 'back', label: 'ID back', url: kyc.document_back_url },
        { key: 'selfie', label: 'Selfie', url: kyc.selfie_url },
      ]
    : [];

  const checklist = progress
    ? [
        { label: 'Liveness check', done: !!progress.liveness_test_completed, tier: 1 },
        { label: 'BVN verified', done: !!progress.bvn_verified, tier: 1 },
        { label: 'ID / face match', done: !!progress.id_face_verified, tier: 1 },
        { label: 'Personal info', done: !!progress.personal_info_completed, tier: 2 },
        { label: 'ID documents verified', done: !!progress.documents_verified, tier: 2 },
        { label: 'Address completed', done: !!progress.address_completed, tier: 3 },
        { label: 'Proof of address verified', done: !!progress.utility_bill_verified, tier: 3 },
      ]
    : [];

  const handleReview = async (decision: 'approve' | 'reject') => {
    if (!userId) return;
    if (decision === 'reject' && !reason.trim()) {
      showToast('Please enter a reason for rejecting', 'warning');
      return;
    }

    try {
      const result = await reviewMutation.mutateAsync({
        userId,
        decision,
        reason: decision === 'reject' ? reason.trim() : undefined,
      });
      showToast(
        decision === 'approve'
          ? `Approved. User is now Tier ${result.tier}.`
          : 'Tier 3 submission rejected.',
        'success'
      );
      setMode(null);
      setReason('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save review', 'error', 5000);
    }
  };

  const showActions = status === 'pending' && (canApprove || canReject);
  const submittedAt = kyc?.utility_bill_validation_result?.submitted_at;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="KYC review"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-gray-50 shadow-2xl flex flex-col"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white">
              <span className="text-sm font-semibold">
                {kyc?.first_name?.[0]}
                {kyc?.last_name?.[0]}
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 truncate">{fullName || 'KYC review'}</h2>
              <p className="text-sm text-gray-500 truncate">{data?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && <TierBadge tier={tier} />}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-error">
              Failed to load KYC details. {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && !kyc && (
            <p className="text-center text-gray-500 py-16">No KYC record found for this user.</p>
          )}

          {kyc && (
            <>
              {/* Tier 3 review */}
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Tier 3 review</h3>
                  <ReviewStatusBadge status={status} />
                </div>

                {status ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-gray-500">Document type</dt>
                      <dd className="font-medium text-gray-900">
                        {kyc.utility_bill_validation_result?.bill_type_label || 'Utility bill'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Submitted</dt>
                      <dd className="font-medium text-gray-900">{formatDate(submittedAt ?? kyc.updated_at)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-gray-500">Address on file</dt>
                      <dd className="font-medium text-gray-900">
                        {kyc.address
                          ? `${kyc.address_no ? kyc.address_no + ', ' : ''}${kyc.address}${kyc.lga ? ', ' + kyc.lga : ''}${kyc.state ? ', ' + kyc.state : ''}`
                          : 'No address on file'}
                      </dd>
                    </div>
                    {status !== 'pending' && (
                      <>
                        <div>
                          <dt className="text-gray-500">Reviewed by</dt>
                          <dd className="font-medium text-gray-900">{data?.reviewer_name || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Reviewed</dt>
                          <dd className="font-medium text-gray-900">{formatDate(kyc.utility_bill_reviewed_at)}</dd>
                        </div>
                      </>
                    )}
                    {status === 'rejected' && kyc.utility_bill_rejection_reason && (
                      <div className="col-span-2 rounded-lg bg-gray-50 p-3 text-gray-700">
                        <span className="font-medium">Reason: </span>
                        {kyc.utility_bill_rejection_reason}
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">This user has not submitted Tier 3 documents.</p>
                )}

                {status === 'pending' && tier < 2 && (
                  <div className="mt-4 flex gap-2 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    This user has not completed Tier 2, so Tier 3 cannot be approved yet.
                  </div>
                )}

                {showActions && mode === null && (
                  <div className="mt-4 flex gap-3">
                    {canApprove && (
                      <button
                        onClick={() => setMode('approve')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-light transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve Tier 3
                      </button>
                    )}
                    {canReject && (
                      <button
                        onClick={() => setMode('reject')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 font-medium hover:bg-gray-50 transition-colors"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    )}
                  </div>
                )}

                {mode === 'approve' && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-700 mb-3">
                      Confirm that the proof of address is valid and matches the address on file. The user will be
                      upgraded to Tier 3 immediately.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview('approve')}
                        disabled={reviewMutation.isPending}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirm approval
                      </button>
                      <button
                        onClick={() => setMode(null)}
                        disabled={reviewMutation.isPending}
                        className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'reject' && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <label htmlFor="kyc-reject-reason" className="block text-sm font-medium text-gray-900 mb-2">
                      Reason for rejection (required)
                    </label>
                    <textarea
                      id="kyc-reject-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. Document is older than 3 months, or name does not match"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleReview('reject')}
                        disabled={reviewMutation.isPending || !reason.trim()}
                        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirm rejection
                      </button>
                      <button
                        onClick={() => setMode(null)}
                        disabled={reviewMutation.isPending}
                        className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Documents */}
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Documents</h3>
                <div className="grid grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <DocumentTile
                      key={doc.key}
                      doc={doc}
                      onPreview={(url) => setLightbox({ url, label: doc.label })}
                    />
                  ))}
                </div>
              </section>

              {/* Verification checklist */}
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Verification progress</h3>
                  <span className="text-xs text-gray-500">
                    Step: {progress?.current_step?.replace(/_/g, ' ') || 'not started'}
                  </span>
                </div>
                <ul className="space-y-2">
                  {checklist.map((item) => (
                    <li key={item.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-700">
                        {item.done ? (
                          <CheckCircle className="h-4 w-4 text-gray-900" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-300" />
                        )}
                        {item.label}
                      </span>
                      <span className="text-xs text-gray-400">Tier {item.tier}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Personal info */}
              <section className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Personal information</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Field label="Full name" value={fullName} icon={<UserIcon className="h-3.5 w-3.5" />} />
                  <Field label="Date of birth" value={kyc.date_of_birth && formatDate(kyc.date_of_birth, 'MMMM d, yyyy')} />
                  <Field label="State" value={kyc.state} icon={<MapPin className="h-3.5 w-3.5" />} />
                  <Field label="BVN" value={maskId(kyc.bvn)} mono />
                  <Field label="NIN" value={maskId(kyc.nin)} mono />
                  <Field label="ID type" value={documentName} />
                  <Field label="ID number" value={kyc.document_number} mono />
                  <Field label="Bank" value={kyc.bank_name} />
                  <Field label="Account number" value={kyc.account_number} mono />
                </dl>
              </section>
            </>
          )}
        </div>

        {kyc && (
          <footer className="px-5 py-3 bg-white border-t border-gray-100">
            <Link
              to={`/users/${kyc.user_id}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              View full user profile
              <ExternalLink className="h-4 w-4" />
            </Link>
          </footer>
        )}
      </aside>

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="w-full max-w-4xl flex items-center justify-between text-white mb-3">
            <span className="font-medium">{lightbox.label}</span>
            <button
              onClick={() => setLightbox(null)}
              className="p-2 rounded-lg hover:bg-white/10"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <img
            src={lightbox.url}
            alt={lightbox.label}
            className="max-h-[80vh] max-w-full rounded-lg object-contain bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </dt>
      <dd className={`font-medium text-gray-900 break-words ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
    </div>
  );
}

function DocumentTile({ doc, onPreview }: { doc: DocItem; onPreview: (url: string) => void }) {
  const [failed, setFailed] = useState(false);
  const { url, label, tier3 } = doc;

  if (!url) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 flex flex-col items-center justify-center h-36 text-center">
        <FileText className="h-6 w-6 text-gray-300 mb-1" />
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-[11px] text-gray-400">Not provided</span>
      </div>
    );
  }

  const pdf = isPdf(url);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {pdf || failed ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="h-28 flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
        >
          <FileText className="h-7 w-7" />
          <span className="text-xs">{pdf ? 'Open PDF' : 'Open file'}</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onPreview(url)}
          className="group relative block w-full h-28 bg-gray-100"
          aria-label={`Preview ${label}`}
        >
          <img
            src={url}
            alt={label}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100" />
          </span>
        </button>
      )}
      <div className="px-2.5 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700 truncate">{label}</span>
        {tier3 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Tier 3</span>}
      </div>
    </div>
  );
}
