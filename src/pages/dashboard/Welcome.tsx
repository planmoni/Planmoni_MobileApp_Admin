import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { supabase } from '@/lib/supabase';
import {
  Home,
  Users,
  CreditCard,
  BarChart3,
  Activity,
  FileText,
  DollarSign,
  CalendarDays,
  Repeat,
  AlertTriangle,
  Image,
  Smartphone,
  ScrollText,
  Mail,
  Bell,
  BookOpen,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function Welcome() {
  const { session } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [userProfile, setUserProfile] = useState<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', session.user.id)
          .single();

        setUserProfile(data);
      }
    };

    fetchUserProfile();
  }, [session]);

  const hasDashboardPermissions = () => {
    if (isSuperAdmin) return true;

    const dashboardPermissions = [
      'stats.new_users', 'stats.deposits', 'stats.payouts', 'stats.new_plans',
      'stats.kyc_completed', 'stats.locked_balance', 'stats.cancelled_plans',
      'stats.withdrawals', 'stats.payout_due_today', 'charts.transaction_volume',
      'charts.plan_distribution', 'lists.todays_transactions', 'lists.users_joined_today',
      'lists.todays_payout_events', 'lists.todays_activities'
    ];

    return dashboardPermissions.some(action => hasPermission('dashboard', action));
  };

  const allNavigationItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: Home,
      resource: 'dashboard',
      action: 'view',
      customCheck: hasDashboardPermissions,
      description: 'View key metrics and statistics',
      color: 'from-blue-500 to-blue-600'
    },
    {
      name: 'Users',
      path: '/users',
      icon: Users,
      resource: 'users',
      action: 'list',
      description: 'Manage user accounts',
      color: 'from-purple-500 to-purple-600'
    },
    {
      name: 'Calendar',
      path: '/calendar',
      icon: CalendarDays,
      resource: 'calendar',
      action: 'view',
      description: 'View payout events calendar',
      color: 'from-green-500 to-green-600'
    },
    {
      name: 'Transactions',
      path: '/transactions',
      icon: CreditCard,
      resource: 'transactions',
      action: 'list',
      description: 'Track all transactions',
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      name: 'Analytics',
      path: '/analytics',
      icon: BarChart3,
      resource: 'analytics',
      action: 'overview',
      description: 'View detailed analytics',
      color: 'from-red-500 to-red-600'
    },
    {
      name: 'Activity',
      path: '/activity',
      icon: Activity,
      resource: 'activity',
      action: 'view',
      description: 'Monitor system activity',
      color: 'from-teal-500 to-teal-600'
    },
    {
      name: 'KYC Data',
      path: '/kyc-data',
      icon: FileText,
      resource: 'kyc',
      action: 'list',
      description: 'Review KYC submissions',
      color: 'from-orange-500 to-orange-600'
    },
    {
      name: 'Payout Events',
      path: '/payout-events',
      icon: DollarSign,
      resource: 'payout_events',
      action: 'list',
      description: 'Manage payout events',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      name: 'Payout Plans',
      path: '/payout-plans',
      icon: Repeat,
      resource: 'payout_plans',
      action: 'list',
      description: 'View user payout plans',
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      name: 'Emergency Withdrawals',
      path: '/emergency-withdrawals',
      icon: AlertTriangle,
      resource: 'emergency_withdrawals',
      action: 'list',
      description: 'Process emergency requests',
      color: 'from-rose-500 to-rose-600'
    },
    {
      name: 'Marketing',
      path: '/marketing',
      icon: Mail,
      resource: 'marketing',
      action: 'view',
      description: 'Manage marketing campaigns',
      color: 'from-pink-500 to-pink-600'
    },
    {
      name: 'Notifications',
      path: '/notifications',
      icon: Bell,
      resource: 'notifications',
      action: 'view',
      description: 'Send push notifications',
      color: 'from-violet-500 to-violet-600'
    },
    {
      name: 'Blog',
      path: '/blog',
      icon: BookOpen,
      resource: 'blog',
      action: 'view',
      description: 'Manage blog posts',
      color: 'from-amber-500 to-amber-600'
    },
    {
      name: 'Banners',
      path: '/banners',
      icon: Image,
      resource: 'banners',
      action: 'view',
      description: 'Manage app banners',
      color: 'from-lime-500 to-lime-600'
    },
    {
      name: 'App Versions',
      path: '/app-versions',
      icon: Smartphone,
      resource: 'app_versions',
      action: 'view',
      description: 'Manage app versions',
      color: 'from-sky-500 to-sky-600'
    },
    {
      name: 'Audit Logs',
      path: '/audit-logs',
      icon: ScrollText,
      resource: 'audit_logs',
      action: 'view',
      description: 'View audit trail',
      color: 'from-slate-500 to-slate-600'
    },
  ];

  const availableItems = allNavigationItems.filter(item => {
    if (item.customCheck) {
      return item.customCheck();
    }
    return hasPermission(item.resource, item.action);
  });

  const getUserDisplayName = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name;
    }
    if (userProfile?.email) {
      return userProfile.email.split('@')[0];
    }
    return 'User';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {getGreeting()}, {getUserDisplayName()}!
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                Welcome to your admin dashboard
              </p>
            </div>
          </div>
        </div>

        {availableItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Access</h3>
            <p className="text-gray-600">
              You don't have access to any sections yet. Please contact your administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-transparent"
              >
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300"
                     style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
                />

                <div className="relative p-6">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="h-7 w-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </h3>

                  <p className="text-gray-600 text-sm mb-4">
                    {item.description}
                  </p>

                  <div className="flex items-center text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
                    <span>Open</span>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
