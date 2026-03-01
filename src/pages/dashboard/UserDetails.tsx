import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Calendar, Building2, ArrowUpRight, ArrowDownRight, RefreshCw, Shield, Lock, TrendingUp, Clock, CheckCircle2, XCircle, User, Phone, MapPin, FileText, CreditCard, CheckCircle, XCircleIcon, AlertCircle } from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { useUserDetails } from '@/hooks/queries/useUsersData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { PayoutCountdown } from '@/components/PayoutCountdown';

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: userDetailsData, isLoading, error } = useUserDetails(id!);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    if (id) {
      refreshData.mutate(['user', id]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !userDetailsData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-red-600 mb-4">User not found</h2>
        <p className="text-gray-500 mb-6">
          The user you're looking for doesn't exist or may have been removed.
        </p>
        <Link
          to="/users"
          className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Users
        </Link>
      </div>
    );
  }

  const { user, transactions, payoutPlans, bankAccounts, kycData, kycProgress } = userDetailsData;

  // Calculate user stats
  const totalDeposits = transactions
    .filter((t: any) => t.type === 'deposit' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const totalPayouts = transactions
    .filter((t: any) => t.type === 'payout' && t.status === 'completed')
    .reduce((sum: number, t: any) => sum + t.amount, 0);

  const activePlans = payoutPlans.filter((p: any) => p.status === 'active').length;
  const completedPlans = payoutPlans.filter((p: any) => p.status === 'completed').length;
  const cancelledPlans = payoutPlans.filter((p: any) => p.status === 'cancelled').length;

  // Filter out completed and cancelled plans for display
  const activePayoutPlans = payoutPlans.filter((p: any) => p.status !== 'completed' && p.status !== 'cancelled');

  // Calculate end date for a payout plan
  const calculateEndDate = (plan: any) => {
    if (!plan.start_date) return null;

    const startDate = new Date(plan.start_date);
    if (isNaN(startDate.getTime())) return null;

    switch (plan.frequency) {
      case 'daily':
        return addDays(startDate, plan.duration - 1);
      case 'weekly':
        return addWeeks(startDate, plan.duration - 1);
      case 'monthly':
        return addMonths(startDate, plan.duration - 1);
      default:
        return startDate;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/users"
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">User Details</h1>
            <p className="text-gray-500">View and manage user information</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-[#000] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
              {user.is_admin && (
                <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 flex items-center gap-1.5 border border-blue-100">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-1">{user.email}</p>
            <p className="text-gray-400 text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Joined {format(new Date(user.created_at), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-gray-900">₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Deposits</p>
              <p className="text-3xl font-bold text-gray-900">₦{totalDeposits.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Payouts</p>
              <p className="text-3xl font-bold text-gray-900">₦{totalPayouts.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Active Plans</p>
              <p className="text-3xl font-bold text-gray-900">{activePlans}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/users/${id}/completed-payouts`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Completed Payouts</p>
              <p className="text-3xl font-bold text-gray-900">{completedPlans}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/users/${id}/cancelled-payouts`)}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Cancelled Payouts</p>
              <p className="text-3xl font-bold text-gray-900">{cancelledPlans}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Wallet Information</h2>
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Available Balance</p>
                    <p className="text-2xl font-bold text-gray-900">₦{user.wallets?.[0]?.balance.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Locked Balance</p>
                    <p className="text-2xl font-bold text-gray-900">₦{user.wallets?.[0]?.locked_balance.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Balance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₦{((user.wallets?.[0]?.balance || 0) + (user.wallets?.[0]?.locked_balance || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payout Accounts</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {bankAccounts.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {bankAccounts.map((account: any) => (
                  <div key={account.id} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-base font-semibold text-gray-900">{account.bank_name}</p>
                          {account.is_default && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                              Default
                            </span>
                          )}
                   
                        </div>
                        <p className="text-gray-900 text-sm font-mono mb-1">{account.account_number}</p>
                        <p className="text-gray-600 text-sm mb-2">{account.account_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Added {format(new Date(account.created_at), 'MMM d, yyyy')}</span>
                          {account.paystack_recipient_code && (
                            <>
                              <span>•</span>
                              <span className="font-mono">{account.paystack_recipient_code}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No payout accounts added</p>
                <p className="text-gray-400 text-sm mt-1">User hasn't added any bank accounts yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {kycData && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">KYC Information</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  kycData.tier === 3 ? 'bg-purple-50' :
                  kycData.tier === 2 ? 'bg-green-50' :
                  kycData.tier === 1 ? 'bg-blue-50' : 'bg-gray-50'
                }`}>
                  {kycData.tier === 3 ? (
                    <CheckCircle className="h-6 w-6 text-purple-600" />
                  ) : kycData.tier === 2 ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : kycData.tier === 1 ? (
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-gray-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Verification Status</p>
                  <p className={`text-lg font-bold ${
                    kycData.tier === 3 ? 'text-purple-600' :
                    kycData.tier === 2 ? 'text-green-600' :
                    kycData.tier === 1 ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {kycData.tier === 3 ? 'Tier 3' :
                     kycData.tier === 2 ? 'Tier 2' :
                     kycData.tier === 1 ? 'Tier 1' : 'Unverified'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Information
                    </p>
                    <div className="pl-6 space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {kycData.first_name} {kycData.middle_name ? kycData.middle_name + ' ' : ''}{kycData.last_name}
                        </p>
                      </div>
                      {kycData.date_of_birth && !isNaN(new Date(kycData.date_of_birth).getTime()) && (
                        <div>
                          <p className="text-xs text-gray-500">Date of Birth</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {format(new Date(kycData.date_of_birth), 'MMMM d, yyyy')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {kycData.phone_number && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Contact Information
                      </p>
                      <div className="pl-6 space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Phone Number</p>
                          <p className="text-sm font-semibold text-gray-900">{kycData.phone_number}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {kycData.address && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address Information
                      </p>
                      <div className="pl-6 space-y-2">
                        <div>
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {kycData.address_no ? `${kycData.address_no}, ` : ''}{kycData.address}
                          </p>
                        </div>
                        {(kycData.lga || kycData.state) && (
                          <div className="grid grid-cols-2 gap-2">
                            {kycData.lga && (
                              <div>
                                <p className="text-xs text-gray-500">LGA</p>
                                <p className="text-sm font-semibold text-gray-900">{kycData.lga}</p>
                              </div>
                            )}
                            {kycData.state && (
                              <div>
                                <p className="text-xs text-gray-500">State</p>
                                <p className="text-sm font-semibold text-gray-900">{kycData.state}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Identity Verification
                    </p>
                    <div className="pl-6 space-y-2">
                      {kycData.bvn && (
                        <div>
                          <p className="text-xs text-gray-500">BVN</p>
                          <p className="text-sm font-mono font-semibold text-gray-900">
                            {kycData.bvn.length > 6
                              ? `${kycData.bvn.slice(0, 3)}${'*'.repeat(kycData.bvn.length - 6)}${kycData.bvn.slice(-3)}`
                              : kycData.bvn
                            }
                          </p>
                        </div>
                      )}
                      {kycData.nin && (
                        <div>
                          <p className="text-xs text-gray-500">NIN</p>
                          <p className="text-sm font-mono font-semibold text-gray-900">
                            {kycData.nin.length > 6
                              ? `${kycData.nin.slice(0, 3)}${'*'.repeat(kycData.nin.length - 6)}${kycData.nin.slice(-3)}`
                              : kycData.nin
                            }
                          </p>
                        </div>
                      )}
                      {kycData.document_type && (
                        <div>
                          <p className="text-xs text-gray-500">Document Type</p>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{kycData.document_type}</p>
                        </div>
                      )}
                      {kycData.document_number && (
                        <div>
                          <p className="text-xs text-gray-500">Document Number</p>
                          <p className="text-sm font-mono font-semibold text-gray-900">{kycData.document_number}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {(kycData.bank_name || kycData.account_number) && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Bank Information
                      </p>
                      <div className="pl-6 space-y-2">
                        {kycData.bank_name && (
                          <div>
                            <p className="text-xs text-gray-500">Bank Name</p>
                            <p className="text-sm font-semibold text-gray-900">{kycData.bank_name}</p>
                          </div>
                        )}
                        {kycData.account_number && (
                          <div>
                            <p className="text-xs text-gray-500">Account Number</p>
                            <p className="text-sm font-mono font-semibold text-gray-900">{kycData.account_number}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {kycProgress && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Verification Stages
                      </p>
                      <div className="pl-6 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Personal Info</span>
                          {kycProgress.personal_info_completed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">BVN Verification</span>
                          {kycProgress.bvn_verified ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Documents Verified</span>
                          {kycProgress.documents_verified ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Address Completed</span>
                          {kycProgress.address_completed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircleIcon className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {kycData.created_at && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Submitted:</span> {format(new Date(kycData.created_at), 'MMM d, yyyy')}
                    </div>
                    {kycData.updated_at && (
                      <div>
                        <span className="font-medium">Last Updated:</span> {format(new Date(kycData.updated_at), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Active Payout Plans</h2>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
          {activePayoutPlans.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {activePayoutPlans.map((plan: any) => {
                const endDate = calculateEndDate(plan);
                return (
                  <div key={plan.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                        {plan.created_at && (
                          <p className="text-sm text-gray-500">
                            Created {format(new Date(plan.created_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        plan.status === 'active'
                          ? 'bg-green-50 text-green-600 border border-green-100'
                          : plan.status === 'paused'
                            ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                            : plan.status === 'completed'
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-gray-50 text-gray-600 border border-gray-100'
                      }`}>
                        {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                      </span>
                    </div>

                    {plan.next_payout_date && plan.status === 'active' && new Date(plan.next_payout_date).getTime() && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Next Payout In</p>
                        </div>
                        <PayoutCountdown targetDate={plan.next_payout_date} />
                        <p className="text-xs text-gray-500 mt-1">
                          Due on {format(new Date(plan.next_payout_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Total Amount</p>
                        <p className="text-base font-bold text-gray-900">₦{plan.total_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Payout Amount</p>
                        <p className="text-base font-bold text-gray-900">₦{plan.payout_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Frequency</p>
                        <p className="text-base font-bold text-gray-900">
                          {plan.frequency.charAt(0).toUpperCase() + plan.frequency.slice(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Progress</p>
                        <p className="text-base font-bold text-gray-900">{plan.completed_payouts}/{plan.duration}</p>
                      </div>
                    </div>

                    {endDate && !isNaN(endDate.getTime()) && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-medium text-gray-500 mb-1">Plan End Date</p>
                        <p className="text-sm font-bold text-gray-900">{format(endDate, 'MMMM d, yyyy')}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{Math.round((plan.completed_payouts / plan.duration) * 100)}% complete</span>
                        <span>{plan.duration - plan.completed_payouts} remaining</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((plan.completed_payouts / plan.duration) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No payout plans found</p>
              <p className="text-gray-400 text-sm mt-1">User hasn't created any plans yet</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Transactions</h2>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
          {transactions.length > 0 ? (
            <>
              <div className="divide-y divide-gray-100">
                {transactions.slice(0, 5).map((transaction: any) => (
                  <div key={transaction.id} className="p-5 hover:bg-gray-50 transition-colors flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        transaction.type === 'deposit' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <ArrowUpRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-gray-900 mb-1">
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-lg mt-1.5 ${
                          transaction.status === 'completed'
                            ? 'bg-green-50 text-green-600 border border-green-100'
                            : transaction.status === 'pending'
                              ? 'bg-yellow-50 text-yellow-600 border border-yellow-100'
                              : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <p className={`text-xl font-bold ${
                      transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
              {transactions.length > 5 && (
                <div className="border-t border-gray-100 p-4 text-center bg-gray-50">
                  <Link
                    to="/transactions"
                    state={{ userId: id, userName: `${user.first_name} ${user.last_name}` }}
                    className="text-gray-900 hover:text-gray-700 text-sm font-semibold transition-colors"
                  >
                    View All {transactions.length} Transactions
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <ArrowUpRight className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No transactions found</p>
              <p className="text-gray-400 text-sm mt-1">User hasn't made any transactions yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}