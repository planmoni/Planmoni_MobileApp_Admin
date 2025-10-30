import { X, ArrowUpRight, ArrowDownRight, User, Calendar, Hash, CreditCard, ArrowLeftRight, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  user_id?: string;
  type: string;
  amount: number;
  status: string;
  source: string;
  destination: string;
  reference?: string | null;
  description: string | null;
  created_at: string;
  updated_at?: string;
  profiles?: Array<{
    first_name: string | null;
    last_name: string | null;
    email: string;
  }> | {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

interface TransactionDetailsModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TransactionDetailsModal({ transaction, isOpen, onClose }: TransactionDetailsModalProps) {
  if (!isOpen || !transaction) return null;

  const isPositive = transaction.type === 'deposit';

  const getUserName = () => {
    const profile = Array.isArray(transaction.profiles) ? transaction.profiles[0] : transaction.profiles;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.first_name) {
      return profile.first_name;
    }
    return profile?.email || 'Unknown User';
  };

  const getUserEmail = () => {
    const profile = Array.isArray(transaction.profiles) ? transaction.profiles[0] : transaction.profiles;
    return profile?.email || '';
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Transaction Details</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${
                  isPositive ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {isPositive ? (
                    <ArrowUpRight className="h-10 w-10 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-10 w-10 text-red-600" />
                  )}
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Amount</p>
                <p className={`text-4xl font-bold ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isPositive ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Hash className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Transaction ID</p>
                    <p className="text-sm text-gray-900 break-all">{transaction.id}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Type</p>
                    <p className="text-sm text-gray-900 capitalize">{transaction.type}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">User</p>
                    <p className="text-sm text-gray-900">{getUserName()}</p>
                    <p className="text-xs text-gray-500">{getUserEmail()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-500">Source</p>
                      <p className="text-sm text-gray-900 break-words">{transaction.source}</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                        <ArrowLeftRight className="h-5 w-5 text-purple-600 rotate-180" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-500">Destination</p>
                      <p className="text-sm text-gray-900 break-words">{transaction.destination}</p>
                    </div>
                  </div>
                </div>

                {transaction.reference && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-500">Reference</p>
                      <p className="text-sm text-gray-900 break-all">{transaction.reference}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-gray-600" />
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Date & Time</p>
                    <p className="text-sm text-gray-900">
                      {format(new Date(transaction.created_at), 'MMMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(transaction.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className={`px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                    </div>
                  </div>
                </div>

                {transaction.description && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-900">{transaction.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
