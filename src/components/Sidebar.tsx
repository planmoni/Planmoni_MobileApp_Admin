import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Home,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  Image,
  Activity,
  FileText,
  DollarSign
} from 'lucide-react';

export default function Sidebar({ isMobileMenuOpen, closeMobileMenu }: { isMobileMenuOpen: boolean, closeMobileMenu: () => void }) {
  const { signOut, session } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    is_admin: boolean;
  } | null>(null);

  useEffect(() => {
    if (session?.user) {
      console.log('🔍 Session user found:', session.user.id, session.user.email);
      checkSuperAdminStatus();
      fetchUserProfile();
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

  const fetchUserProfile = async () => {
    try {
      if (!session?.user?.id) return;

      console.log('👤 Fetching user profile for:', session.user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, is_admin')
        .eq('id', session.user.id)
        .single();

      console.log('👤 Profile data:', data);
      console.log('👤 Profile error:', error);

      if (error) {
        console.error('Error fetching user profile:', error);
        setUserProfile({
          first_name: session.user.user_metadata?.first_name || null,
          last_name: session.user.user_metadata?.last_name || null,
          email: session.user.email || null,
          is_admin: session.user.user_metadata?.is_admin || false
        });
      } else {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile({
        first_name: session?.user?.user_metadata?.first_name || null,
        last_name: session?.user?.user_metadata?.last_name || null,
        email: session?.user?.email || null,
        is_admin: session?.user?.user_metadata?.is_admin || false
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Transactions', path: '/transactions', icon: CreditCard },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Activity', path: '/activity', icon: Activity },
    { name: 'KYC Data', path: '/kyc-data', icon: FileText },
    { name: 'Payout Events', path: '/payout-events', icon: DollarSign },
    ...(isSuperAdmin ? [{ name: 'Super Admin', path: '/super-admin', icon: Shield }] : []),
    { name: 'Banners', path: '/banners', icon: Image },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  console.log('🔧 Current state:');
  console.log('  - isSuperAdmin:', isSuperAdmin);
  console.log('  - userProfile:', userProfile);
  console.log('  - navigation items:', navigation.length);
  console.log('  - session user id:', session?.user?.id);

  const sidebarClasses = `
    ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-20 w-64' : 'hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-10'}
    flex-col min-h-0 bg-white border-r border-gray-100
  `;

  const getUserDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    if (userProfile?.first_name) {
      return userProfile.first_name;
    }
    if (userProfile?.email) {
      return userProfile.email.split('@')[0];
    }
    return 'User';
  };

  const getUserInitials = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase();
    }
    if (userProfile?.first_name) {
      return userProfile.first_name[0].toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <aside className={sidebarClasses}>
      <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-gray-100">
        <img
          src="/assets/images/Planmoni-Office.png"
          alt="Planmoni Office"
          className="h-12 w-auto"
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
      <div className="flex-shrink-0 border-t border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                <span className="text-sm font-semibold">{getUserInitials()}</span>
              </div>
            </div>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{getUserDisplayName()}</p>
              <p className="text-xs text-gray-500 truncate">
                {userProfile?.email || session?.user?.email || 'No email'}
              </p>
              {isSuperAdmin && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700 mt-1">
                  <Shield className="h-3 w-3 mr-1" />
                  Super Admin
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0 ml-2"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
