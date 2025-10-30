import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, CheckCircle, Clock, FileText, Image as ImageIcon, User, Phone, MapPin, Calendar } from 'lucide-react';
import { useKycData } from '@/hooks/queries/useKycData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { format } from 'date-fns';

export default function KycData() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const { data, isLoading, error } = useKycData(searchQuery, statusFilter);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['kyc-data']);
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load KYC data</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const { kycData = [], stats } = data || {};

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">KYC Data</h1>
          <p className="text-gray-500">Manage and review user verification data</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Submissions</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">All KYC submissions</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Approved</p>
              <p className="text-3xl font-bold text-green-600">{stats?.approved || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Verified accounts</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{stats?.pending || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Awaiting review</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.completed || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Fully completed KYC</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, BVN, or NIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer text-sm"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {(searchQuery || statusFilter !== 'all') && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-gray-900">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:text-gray-900">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {kycData && kycData.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Verification
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Documents
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kycData.map((kyc: any) => (
                    <tr
                      key={kyc.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/users/${kyc.user_id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                            <span className="text-sm font-semibold">
                              {kyc.first_name?.[0]}{kyc.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {kyc.first_name} {kyc.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{kyc.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-3 w-3" />
                            {kyc.phone_number}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <MapPin className="h-3 w-3" />
                            {kyc.state}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {kyc.bvn && (
                            <div className="text-xs text-gray-500">
                              BVN: {kyc.bvn.substring(0, 4)}****
                            </div>
                          )}
                          {kyc.nin && (
                            <div className="text-xs text-gray-500">
                              NIN: {kyc.nin.substring(0, 4)}****
                            </div>
                          )}
                          {kyc.document_type && (
                            <div className="text-xs font-medium text-gray-600">
                              {kyc.document_type}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {kyc.document_front_url && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Front
                            </span>
                          )}
                          {kyc.document_back_url && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              Back
                            </span>
                          )}
                          {kyc.selfie_url && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs">
                              <User className="h-3 w-3 mr-1" />
                              Selfie
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {kyc.approved ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-yellow-50 text-yellow-700 text-sm font-medium">
                            <Clock className="h-4 w-4 mr-1" />
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-xs">
                            {kyc.kyc_progress?.personal_info_completed && (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            )}
                            {kyc.kyc_progress?.bvn_verified && (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            )}
                            {kyc.kyc_progress?.documents_verified && (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            )}
                            {kyc.kyc_progress?.address_completed && (
                              <CheckCircle className="h-3 w-3 text-green-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {kyc.kyc_progress?.current_step || 'Not started'}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(kyc.created_at), 'MMM d, yyyy')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {kycData.map((kyc: any) => (
                <div
                  key={kyc.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/users/${kyc.user_id}`)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                      <span className="text-sm font-semibold">
                        {kyc.first_name?.[0]}{kyc.last_name?.[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-0.5">
                        {kyc.first_name} {kyc.last_name}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{kyc.user?.email}</div>
                    </div>
                    {kyc.approved ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium flex-shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700 text-xs font-medium flex-shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{kyc.phone_number}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{kyc.state}</span>
                        </div>
                      </div>
                    </div>

                    {(kyc.bvn || kyc.nin || kyc.document_type) && (
                      <div className="pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-500 mb-1">Verification</div>
                        <div className="space-y-1">
                          {kyc.bvn && (
                            <div className="text-xs text-gray-600">
                              BVN: {kyc.bvn.substring(0, 4)}****
                            </div>
                          )}
                          {kyc.nin && (
                            <div className="text-xs text-gray-600">
                              NIN: {kyc.nin.substring(0, 4)}****
                            </div>
                          )}
                          {kyc.document_type && (
                            <div className="text-xs font-medium text-gray-700">
                              {kyc.document_type}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1.5">Documents</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {kyc.document_front_url && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Front
                          </span>
                        )}
                        {kyc.document_back_url && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Back
                          </span>
                        )}
                        {kyc.selfie_url && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs">
                            <User className="h-3 w-3 mr-1" />
                            Selfie
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-500">KYC Progress</span>
                        <div className="flex items-center gap-1">
                          {kyc.kyc_progress?.personal_info_completed && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                          {kyc.kyc_progress?.bvn_verified && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                          {kyc.kyc_progress?.documents_verified && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                          {kyc.kyc_progress?.address_completed && (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        {kyc.kyc_progress?.current_step || 'Not started'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <Calendar className="h-3 w-3" />
                      Submitted {format(new Date(kyc.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all'
                ? 'No KYC data matches your filters'
                : 'No KYC data available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
