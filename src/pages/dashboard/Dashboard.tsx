import { RefreshCw, Users, ArrowUpRight, ArrowDownRight, Calendar, Lock, XCircle, Wallet, CheckCircle2, Clock, AlertCircle, Timer } from 'lucide-react';
import { PayoutCountdown } from '@/components/PayoutCountdown';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useDashboardData } from '@/hooks/queries/useDashboardData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useDashboardData();
  const refreshData = useRefreshData();
  const { session } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, is_admin')
          .eq('id', session.user.id)
          .single();

        setUserProfile(data);
      }
    };

    fetchUserProfile();
  }, [session]);

  const handleRefresh = () => {
    refreshData.mutate(['dashboard']);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getDifference = (today: number, yesterday: number) => {
    const diff = today - yesterday;
    const isPositive = diff >= 0;
    return { diff, isPositive };
  };

  const renderComparison = (today: number, yesterday: number, isCount: boolean = true) => {
    const { diff, isPositive } = getDifference(today, yesterday);

    if (diff === 0) {
      return <p className="text-xs text-gray-400 mt-1">Same as yesterday</p>;
    }

    const displayValue = isCount ? Math.abs(diff) : formatCurrency(Math.abs(diff));

    return (
      <p className={`text-xs mt-1 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : '-'}{displayValue} vs yesterday
      </p>
    );
  };

  const planDistributionData = {
    labels: ['Daily', 'Weekly', 'Biweekly', 'Specific Days', 'Month-End', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually', 'Custom'],
    datasets: [
      {
        data: [
          dashboardData?.planDistribution.daily || 0,
          dashboardData?.planDistribution.weekly || 0,
          dashboardData?.planDistribution.biweekly || 0,
          dashboardData?.planDistribution.specificDays || 0,
          dashboardData?.planDistribution.monthEnd || 0,
          dashboardData?.planDistribution.monthly || 0,
          dashboardData?.planDistribution.quarterly || 0,
          dashboardData?.planDistribution.biAnnually || 0,
          dashboardData?.planDistribution.annually || 0,
          dashboardData?.planDistribution.custom || 0,
        ],
        backgroundColor: ['#EF4444', '#22C55E', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6', '#84CC16', '#64748B'],
        borderWidth: 0,
      },
    ],
  };

  const transactionVolumeData = {
    labels: dashboardData?.transactionVolumeTrends.map(trend => format(new Date(trend.day), 'dd/MM')) || [],
    datasets: [
      {
        label: 'Transaction Volume',
        data: dashboardData?.transactionVolumeTrends.map(trend => trend.volume) || [],
        backgroundColor: '#86EFAC',
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0F172A',
        padding: 12,
        borderRadius: 8,
        titleFont: {
          size: 13,
          weight: 600,
        },
        bodyFont: {
          size: 14,
        },
        callbacks: {
          label: function(context: any) {
            return formatCurrency(context.parsed.y);
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#F3F4F6',
          drawBorder: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return '₦' + (value / 1000) + 'k';
          }
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 11,
          },
        },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          padding: 10,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#0F172A',
        padding: 12,
        borderRadius: 8,
      },
    },
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load dashboard data</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const stats = dashboardData || {
    todayUsers: 0,
    todayDeposits: 0,
    todayPayouts: 0,
    todayPlans: 0,
    todayKyc: 0,
    todayLockedBalance: 0,
    todayCancelledPlans: 0,
    todayWithdrawals: 0,
    todayPayoutsDueCount: 0,
    todayPayoutsDueAmount: 0,
    nextPayoutDate: null,
    nextPayoutAmount: 0,
    yesterdayUsers: 0,
    yesterdayDeposits: 0,
    yesterdayPayouts: 0,
    yesterdayPlans: 0,
    yesterdayKyc: 0,
    yesterdayLockedBalance: 0,
    yesterdayCancelledPlans: 0,
    yesterdayWithdrawals: 0,
    yesterdayPayoutsDueCount: 0,
    yesterdayPayoutsDueAmount: 0,
    totalUsers: 0,
    totalDeposits: 0,
    totalPayouts: 0,
    totalPlans: 0,
    activeUsers: 0,
    todayTransactions: [],
    todayUsersJoined: [],
    todayPayoutEvents: [],
    todayKycSubmissions: [],
    todayActivities: [],
    planDistribution: { daily: 0, weekly: 0, biweekly: 0, specificDays: 0, monthEnd: 0, monthly: 0, quarterly: 0, biAnnually: 0, annually: 0, custom: 0 },
    transactionVolumeTrends: [],
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            {getGreeting()}, {userProfile?.first_name || 'Admin'}!
          </h1>
          <p className="text-sm md:text-base text-gray-500">
            {userProfile?.is_admin ? 'Super Admin' : 'Admin'} Dashboard - Today's Overview
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2.5 md:p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4">Today's Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {(isSuperAdmin || hasPermission('dashboard', 'stats.new_users')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">New Users</p>
                <p className="text-xl md:text-3xl font-bold text-gray-900">{stats.todayUsers}</p>
                {renderComparison(stats.todayUsers, stats.yesterdayUsers, true)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.deposits')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Deposits</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{formatCurrency(stats.todayDeposits)}</p>
                {renderComparison(stats.todayDeposits, stats.yesterdayDeposits, false)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.payouts')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Payouts</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{formatCurrency(stats.todayPayouts)}</p>
                {renderComparison(stats.todayPayouts, stats.yesterdayPayouts, false)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.new_plans')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">New Plans</p>
                <p className="text-xl md:text-3xl font-bold text-gray-900">{stats.todayPlans}</p>
                {renderComparison(stats.todayPlans, stats.yesterdayPlans, true)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.kyc_completed')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">KYC Completed</p>
                <p className="text-xl md:text-3xl font-bold text-gray-900">{stats.todayKyc}</p>
                {renderComparison(stats.todayKyc, stats.yesterdayKyc, true)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.locked_balance')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Locked Balance</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{formatCurrency(stats.todayLockedBalance)}</p>
                {renderComparison(stats.todayLockedBalance, stats.yesterdayLockedBalance, false)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Lock className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.cancelled_plans')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Cancelled Plans</p>
                <p className="text-xl md:text-3xl font-bold text-gray-900">{stats.todayCancelledPlans}</p>
                {renderComparison(stats.todayCancelledPlans, stats.yesterdayCancelledPlans, true)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.withdrawals')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Withdrawals</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{formatCurrency(stats.todayWithdrawals)}</p>
                {renderComparison(stats.todayWithdrawals, stats.yesterdayWithdrawals, false)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.payout_due_today')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Payouts Due Today</p>
                <p className="text-xl md:text-3xl font-bold text-gray-900">{stats.todayPayoutsDueCount}</p>
                {renderComparison(stats.todayPayoutsDueCount, stats.yesterdayPayoutsDueCount, true)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.payout_due_today')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Payouts Due Amount</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900 break-words">{formatCurrency(stats.todayPayoutsDueAmount)}</p>
                {renderComparison(stats.todayPayoutsDueAmount, stats.yesterdayPayoutsDueAmount, false)}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
              </div>
            </div>
          </div>
          )}

          {(isSuperAdmin || hasPermission('dashboard', 'stats.payout_due_today')) && (
          <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">Next Payout</p>
                {stats.nextPayoutDate ? (
                  <div className="space-y-2">
                    <PayoutCountdown targetDate={stats.nextPayoutDate} />
                    <p className="text-sm text-gray-600">{formatCurrency(stats.nextPayoutAmount)}</p>
                    <p className="text-xs text-gray-400">{format(new Date(stats.nextPayoutDate), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                ) : (
                  <p className="text-lg md:text-xl font-medium text-gray-400">No upcoming payouts</p>
                )}
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Timer className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {(isSuperAdmin || hasPermission('dashboard', 'charts.transaction_volume')) && (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
          <div className="mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Transaction Volume</h3>
            <p className="text-xs md:text-sm text-gray-500">Last 7 days</p>
          </div>
          <div className="h-48 md:h-64">
            <Bar data={transactionVolumeData} options={chartOptions} />
          </div>
        </div>
        )}

        {(isSuperAdmin || hasPermission('dashboard', 'charts.plan_distribution')) && (
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
          <div className="mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Plan Distribution</h3>
            <p className="text-xs md:text-sm text-gray-500">Today's plans by type</p>
          </div>
          <div className="h-48 md:h-64">
            {stats.todayPlans > 0 ? (
              <Pie data={planDistributionData} options={pieOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No plans created today
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {(isSuperAdmin || hasPermission('dashboard', 'lists.todays_transactions')) && (
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Today's Transactions</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {stats.todayTransactions.length > 0 ? (
              <div>
                {stats.todayTransactions.slice(0, 5).map((transaction, index) => (
                  <div
                    key={transaction.id}
                    className={`flex justify-between items-center p-4 md:p-5 hover:bg-gray-50 transition-colors ${
                      index !== Math.min(stats.todayTransactions.length, 5) - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        transaction.type === 'deposit' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                        )}
                      </div>
                      <div className="ml-3 md:ml-4 min-w-0 flex-1">
                        <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {transaction.profiles?.first_name} {transaction.profiles?.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(transaction.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs md:text-sm font-semibold whitespace-nowrap ml-2 ${
                      transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 text-sm">No transactions today</p>
            )}
            <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
              <Link
                to="/transactions"
                className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
              >
                View All Transactions
              </Link>
            </div>
          </div>
        </div>
        )}

        {(isSuperAdmin || hasPermission('dashboard', 'lists.users_joined_today')) && (
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Users Joined Today</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {stats.todayUsersJoined.length > 0 ? (
              <div>
                {stats.todayUsersJoined.slice(0, 5).map((user, index) => (
                  <div
                    key={user.id}
                    className={`flex justify-between items-center p-4 md:p-5 hover:bg-gray-50 transition-colors ${
                      index !== Math.min(stats.todayUsersJoined.length, 5) - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm flex-shrink-0">
                        <span className="text-xs md:text-sm font-semibold">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </span>
                      </div>
                      <div className="ml-3 md:ml-4 min-w-0 flex-1">
                        <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(user.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/users/${user.id}`}
                      className="px-3 md:px-4 py-1.5 md:py-2 text-xs font-medium text-primary bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap ml-2"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 text-sm">No users joined today</p>
            )}
            <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
              <Link
                to="/users"
                className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
              >
                View All Users
              </Link>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(isSuperAdmin || hasPermission('dashboard', 'lists.todays_payout_events')) && (
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Today's Payout Events</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {stats.todayPayoutEvents.length > 0 ? (
              <div>
                {stats.todayPayoutEvents.slice(0, 5).map((event, index) => (
                  <div
                    key={event.id}
                    className={`p-4 md:p-5 hover:bg-gray-50 transition-colors ${
                      index !== Math.min(stats.todayPayoutEvents.length, 5) - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs md:text-sm font-semibold text-gray-900">
                        {event.payout_plans?.profiles?.first_name} {event.payout_plans?.profiles?.last_name}
                      </p>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        event.status === 'completed' ? 'bg-green-50 text-green-700' :
                        event.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-gray-900">{formatCurrency(event.amount)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(event.scheduled_date).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 text-sm">No payout events today</p>
            )}
            <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
              <Link
                to="/payout-events"
                className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
              >
                View All Payout Events
              </Link>
            </div>
          </div>
        </div>
        )}

        {(isSuperAdmin || hasPermission('dashboard', 'lists.todays_activities')) && (
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Today's Activities</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {stats.todayActivities.length > 0 ? (
              <div>
                {stats.todayActivities.slice(0, 5).map((activity, index) => (
                  <div
                    key={index}
                    className={`flex items-start p-4 md:p-5 hover:bg-gray-50 transition-colors ${
                      index !== Math.min(stats.todayActivities.length, 5) - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activity.type === 'user_joined' ? 'bg-blue-50' :
                      activity.type === 'deposit' ? 'bg-green-50' :
                      activity.type === 'payout' ? 'bg-red-50' :
                      activity.type === 'kyc_submission' ? 'bg-purple-50' :
                      'bg-gray-50'
                    }`}>
                      {activity.type === 'user_joined' ? (
                        <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                      ) : activity.type === 'deposit' ? (
                        <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
                      ) : activity.type === 'payout' ? (
                        <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
                      ) : activity.type === 'kyc_submission' ? (
                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
                      ) : (
                        <Clock className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
                      )}
                    </div>
                    <div className="ml-3 md:ml-4 flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-gray-900 break-words">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500 text-sm">No activities today</p>
            )}
            <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
              <Link
                to="/activity"
                className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
              >
                View All Activities
              </Link>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
