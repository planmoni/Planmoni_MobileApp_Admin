import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { useUserDetails } from '@/hooks/queries/useUsersData';

export default function CompletedPayouts() {
  const { id } = useParams<{ id: string }>();
  const { data: userDetailsData, isLoading, error } = useUserDetails(id!);

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

  const { user, payoutPlans } = userDetailsData;
  const completedPlans = payoutPlans.filter((p: any) => p.status === 'completed');

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
            to={`/users/${id}`}
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Completed Payouts</h1>
            <p className="text-gray-500">{user.first_name} {user.last_name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Completed Payouts</p>
            <p className="text-2xl font-bold text-gray-900">{completedPlans.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {completedPlans.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {completedPlans.map((plan: any) => {
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
                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-600 border border-green-100">
                      Completed
                    </span>
                  </div>

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
                      <p className="text-xs font-medium text-gray-500 mb-1">Duration</p>
                      <p className="text-base font-bold text-gray-900">{plan.duration} payouts</p>
                    </div>
                  </div>

                  {endDate && !isNaN(endDate.getTime()) && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-1">Completion Date</p>
                      <p className="text-sm font-bold text-gray-900">{format(endDate, 'MMMM d, yyyy')}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-semibold">All {plan.duration} payouts completed</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full"
                        style={{ width: '100%' }}
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
              <CheckCircle2 className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No completed payouts found</p>
            <p className="text-gray-400 text-sm mt-1">User hasn't completed any payout plans yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
