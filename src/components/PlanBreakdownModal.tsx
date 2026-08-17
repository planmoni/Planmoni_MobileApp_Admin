import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, TrendingUp, Clock, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

type BreakdownItem = {
  installment: number;
  scheduled_date: string;
  payout_amount: number;
  fee_amount: number;
  net_amount: number;
  status: string;
};

type PlanBreakdownModalProps = {
  planId: string | null;
  planName: string;
  userName: string;
  onClose: () => void;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(amount);

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-50 text-green-700';
    case 'due':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-gray-50 text-gray-500';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-3.5 w-3.5" />;
    case 'due':
      return <AlertCircle className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
};

export default function PlanBreakdownModal({ planId, planName, userName, onClose }: PlanBreakdownModalProps) {
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;

    let cancelled = false;
    const fetchBreakdown = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_payout_plan_breakdown', {
          plan_uuid: planId,
        });
        if (rpcError) throw rpcError;
        if (!cancelled) setBreakdown((data as BreakdownItem[]) || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load breakdown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBreakdown();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const totalPayout = breakdown.reduce((sum, b) => sum + Number(b.payout_amount), 0);
  const totalFees = breakdown.reduce((sum, b) => sum + Number(b.fee_amount), 0);
  const totalNet = breakdown.reduce((sum, b) => sum + Number(b.net_amount), 0);
  const completedCount = breakdown.filter((b) => b.status === 'completed').length;
  const dueCount = breakdown.filter((b) => b.status === 'due').length;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 md:p-6 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">Plan Breakdown</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {planName} — {userName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Summary cards */}
        {!loading && !error && breakdown.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 md:p-6 pb-0">
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-600">Total Payouts</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(totalPayout)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium text-orange-600">Total Fees</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(totalFees)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-600">Completed</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{completedCount} / {breakdown.length}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-600">Due</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{dueCount}</p>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-error" />
              <p className="text-gray-600 text-sm">{error}</p>
            </div>
          ) : breakdown.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">No payout schedule available</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-2">
                <table className="w-full">
                  <thead className="bg-gray-50 rounded-lg">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Payout</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fee</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Net</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {breakdown.map((item) => (
                      <tr key={item.installment} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.installment}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {format(new Date(item.scheduled_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(Number(item.payout_amount))}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(Number(item.fee_amount))}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(Number(item.net_amount))}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusStyle(item.status)}`}>
                            {getStatusIcon(item.status)}
                            <span className="capitalize">{item.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900">Total ({breakdown.length} payouts)</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatCurrency(totalPayout)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-700">{formatCurrency(totalFees)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(totalNet)}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {breakdown.map((item) => (
                  <div key={item.installment} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">Payout #{item.installment}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusStyle(item.status)}`}>
                        {getStatusIcon(item.status)}
                        <span className="capitalize">{item.status}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(item.scheduled_date), 'MMM d, yyyy')}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400 mb-0.5">Payout</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(Number(item.payout_amount))}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-0.5">Fee</p>
                        <p className="text-gray-600">{formatCurrency(Number(item.fee_amount))}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-0.5">Net</p>
                        <p className="font-semibold text-green-600">{formatCurrency(Number(item.net_amount))}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t-2 border-gray-200 pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">Total ({breakdown.length} payouts)</span>
                    <span className="font-bold text-gray-900">{formatCurrency(totalPayout)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Fees</span>
                    <span className="font-semibold text-gray-700">{formatCurrency(totalFees)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Net</span>
                    <span className="font-bold text-green-600">{formatCurrency(totalNet)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
