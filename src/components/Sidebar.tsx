import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Home, Users, CreditCard, BarChart3, Shield, Image, Activity, FileText, DollarSign, CalendarDays, Repeat, ScrollText, TriangleAlert as AlertTriangle, Smartphone, Mail, Bell, BookOpen, Vault } from 'lucide-react';

export default function Sidebar({ isMobileMenuOpen, closeMobileMenu }: { isMobileMenuOpen: boolean, closeMobileMenu: () => void }) {
  const { session } = useAuth();
  const { hasPermission } = usePermissions();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (session?.user) {
      console.log('🔍 Session user found:', session.user.id, session.user.email);
      checkSuperAdminStatus();
    }
  }, [session?.user]);

  const checkSuperAdminStatus = async () => {
    try {
      console.log('🚀 Calling is_super_admin RPC...');

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select(`
          *,
          roles (
            name,
            level
          )
        `)
        .eq('user_id', session?.user?.id)
        .eq('is_active', true);

      console.log('🎭 User roles data:', roleData);
      console.log('🎭 User roles error:', roleError);

      const { data, error } = await supabase.rpc('is_super_admin');
      console.log('📊 RPC is_super_admin data:', data);
      console.log('❌ RPC is_super_admin error:', error);

      if (!error && data) {
        console.log('✅ Setting isSuperAdmin to true');
        setIsSuperAdmin(true);
      } else {
        console.log('❌ Setting isSuperAdmin to false');
        setIsSuperAdmin(false);
      }
    } catch (error) {
      console.error('💥 Error checking super admin status:', error);
      setIsSuperAdmin(false);
    }
  };


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
    { name: 'Dashboard', path: '/dashboard', icon: Home, resource: 'dashboard', action: 'view', customCheck: hasDashboardPermissions },
    { name: 'Users', path: '/users', icon: Users, resource: 'users', action: 'list' },
    { name: 'Calendar', path: '/calendar', icon: CalendarDays, resource: 'calendar', action: 'view' },
    { name: 'Transactions', path: '/transactions', icon: CreditCard, resource: 'transactions', action: 'list' },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, resource: 'analytics', action: 'overview' },
    { name: 'Activity', path: '/activity', icon: Activity, resource: 'activity', action: 'view' },
    { name: 'KYC Data', path: '/kyc-data', icon: FileText, resource: 'kyc', action: 'list' },
    { name: 'Payout Events', path: '/payout-events', icon: DollarSign, resource: 'payout_events', action: 'list' },
    { name: 'Payout Plans', path: '/payout-plans', icon: Repeat, resource: 'payout_plans', action: 'list' },
    { name: 'Vaults', path: '/vaults', icon: Vault, resource: 'vaults', action: 'list' },
    { name: 'Emergency Withdrawals', path: '/emergency-withdrawals', icon: AlertTriangle, resource: 'emergency_withdrawals', action: 'list' },
    { name: 'Marketing', path: '/marketing', icon: Mail, resource: 'marketing', action: 'view' },
    { name: 'Notifications', path: '/notifications', icon: Bell, resource: 'notifications', action: 'view' },
    { name: 'Blog', path: '/blog', icon: BookOpen, resource: 'blog', action: 'view' },
    { name: 'Banners', path: '/banners', icon: Image, resource: 'banners', action: 'view' },
    { name: 'App Versions', path: '/app-versions', icon: Smartphone, resource: 'app_versions', action: 'view' },
    { name: 'Audit Logs', path: '/audit-logs', icon: ScrollText, resource: 'audit_logs', action: 'view' },

    ...(isSuperAdmin ? [{ name: 'Super Admin', path: '/super-admin', icon: Shield, resource: 'super_admin', action: 'roles' }] : []),
  ];

  const navigation = isSuperAdmin
    ? allNavigationItems
    : allNavigationItems.filter(item => {
        if (item.customCheck) {
          return item.customCheck();
        }
        return hasPermission(item.resource, item.action);
      });

  console.log('🔧 Current state:');
  console.log('  - isSuperAdmin:', isSuperAdmin);
  console.log('  - navigation items:', navigation.length);
  console.log('  - session user id:', session?.user?.id);

  const sidebarClasses = `
    ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-20 w-64' : 'hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-10'}
    flex-col min-h-0 bg-white border-r border-gray-100
  `;

  return (
    <aside className={sidebarClasses}>
      <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-gray-100">
        <img
          src="/assets/images/planmoni_logo_updated.png"
          alt="Planmoni Office"
          className="h-auto w-auto"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
            if (nextElement) {
              nextElement.style.display = 'block';
            }
          }}
        />
        <h1 className="text-xl font-bold text-primary ml-2" style={{ display: 'none' }}>
          Planmoni Admin
        </h1>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto pt-6 pb-4">
        <nav className="flex-1 px-3 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${item.name === 'Super Admin' ? 'border-l-4 border-red-500' : ''}`
              }
              onClick={isMobileMenuOpen ? closeMobileMenu : undefined}
            >
              <item.icon className={`mr-3 h-5 w-5 ${item.name === 'Super Admin' ? 'text-red-500' : ''}`} />
              {item.name}
              {item.name === 'Super Admin' && (
                <span className="ml-auto px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                  ADMIN
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
