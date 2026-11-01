import { format } from 'date-fns';
import { Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { TierBadge } from '@/components/KycBadges';
import { Field, Panel, EmptyState, titleCase } from '@/components/userDetails/ui';
import type { KycTier } from '@/hooks/queries/useKycData';

const mask = (v?: string | null) =>
  !v ? null : v.length > 6 ? `${v.slice(0, 3)}${'*'.repeat(v.length - 6)}${v.slice(-3)}` : v;

const validDate = (v?: string | null) => (v && !isNaN(new Date(v).getTime()) ? new Date(v) : null);

function Stage({ label, done }: { label: string; done?: boolean | null }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className={`text-sm ${done ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          done ? 'bg-gray-900 text-white' : 'border border-gray-300'
        }`}
      >
        {done && <Check className="h-3 w-3" />}
      </span>
    </li>
  );
}

/** KYC tab of the user profile: tier, what was submitted (BVN / NIN masked) and the verification stages. */
export default function KycPanel({
  kycData,
  kycProgress,
  tier,
}: {
  kycData: any;
  kycProgress: any;
  tier: KycTier;
}) {
  if (!kycData && !kycProgress) {
    return (
      <Panel flush>
        <EmptyState icon={ShieldCheck} title="No KYC submitted" hint="This user hasn't started verification yet" />
      </Panel>
    );
  }

  const k = kycData || {};
  const p = kycProgress || {};
  const dob = validDate(k.date_of_birth);
  const docType = typeof k.document_type === 'object' ? k.document_type?.document_name : k.document_type;
  const fullName = [k.first_name, k.middle_name, k.last_name].filter(Boolean).join(' ');
  const address = [k.address_no, k.address].filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500">Verification level</p>
            <div className="mt-1">
              <TierBadge tier={tier} />
            </div>
          </div>
          {k.created_at && (
            <p className="text-xs text-gray-500 text-right">
              Submitted {format(new Date(k.created_at), 'MMM d, yyyy')}
              {k.updated_at && <> · updated {format(new Date(k.updated_at), 'MMM d, yyyy')}</>}
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Tier 1',
              hint: 'BVN, liveness and ID match',
              stages: [
                ['Liveness check', p.liveness_test_completed],
                ['BVN verified', p.bvn_verified],
                ['ID face match', p.id_face_verified],
              ],
            },
            {
              title: 'Tier 2',
              hint: 'Personal info and ID documents',
              stages: [
                ['Personal info', p.personal_info_completed],
                ['Documents verified', p.documents_verified],
              ],
            },
            {
              title: 'Tier 3',
              hint: 'Proof of address',
              stages: [
                ['Address provided', p.address_completed],
                ['Proof of address approved', p.utility_bill_verified],
              ],
            },
          ].map((group) => (
            <div key={group.title} className="rounded-xl border border-gray-100 p-3.5">
              <p className="text-sm font-semibold text-gray-900">{group.title}</p>
              <p className="text-xs text-gray-500 mb-1.5">{group.hint}</p>
              <ul className="divide-y divide-gray-50">
                {group.stages.map(([label, done]) => (
                  <Stage key={label as string} label={label as string} done={done as boolean | null} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {kycData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Personal details">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Full name" value={fullName || '-'} />
              <Field label="Date of birth" value={dob ? format(dob, 'MMM d, yyyy') : '-'} />
              {k.phone_number && <Field label="Phone number" value={k.phone_number} mono />}
              <Field label="Address" value={address || '-'} />
              {k.lga && <Field label="LGA" value={k.lga} />}
              {k.state && <Field label="State" value={k.state} />}
            </div>
          </Panel>

          <Panel title="Identity">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="BVN" value={mask(k.bvn) || '-'} mono />
              <Field label="NIN" value={mask(k.nin) || '-'} mono />
              <Field label="Document type" value={titleCase(docType) || '-'} />
              <Field label="Document number" value={k.document_number || '-'} mono />
              {k.bank_name && <Field label="Bank" value={k.bank_name} />}
              {k.account_number && <Field label="Account number" value={k.account_number} mono />}
            </div>

            {k.selfie_url && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Verification selfie</p>
                <div className="relative group inline-block">
                  <img
                    src={k.selfie_url}
                    alt="KYC selfie"
                    className="w-24 h-24 object-cover rounded-xl border border-gray-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <a
                    href={k.selfie_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-xl flex items-center justify-center"
                  >
                    <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
