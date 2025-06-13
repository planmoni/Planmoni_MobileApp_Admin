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
  Shield
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
      checkSuperAdminStatus();
      fetchUserProfile();
    }
  }, [session?.user]);

  const checkSuperAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_super_admin');
      if (!error && data) {
        setIsSuperAdmin(true);
      }
    } catch (error) {
      console.error('Error checking super admin status:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, is_admin')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to session data
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
      // Fallback to session data
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
    // Remove explicit navigation - let App.tsx routing handle the redirect
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: Home },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Transactions', path: '/transactions', icon: CreditCard },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    ...(isSuperAdmin ? [{ name: 'Super Admin', path: '/super-admin', icon: Shield }] : []),
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const sidebarClasses = `
    ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-20 w-64' : 'hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-10'}
    flex-col min-h-0 bg-white border-r border-border
  `;

  // Helper function to get user display name
  const getUserDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    if (userProfile?.first_name) {
      return userProfile.first_name;
    }
    if (userProfile?.email) {
      return userProfile.email.split('@')[0]; // Use email username as fallback
    }
    return 'User';
  };

  // Helper function to get user initials
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
      <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-border">
        <img
          src="/public/assets/images/Planmoni-Office.png"
          alt="Planmoni Office"
          className="h-8 w-auto"
          onError={(e) => {
            // Fallback to text if image fails to load
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
      <div className="flex-1 flex flex-col overflow-y-auto pt-5 pb-4">
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-primary-light/10 text-primary'
                    : 'text-text-secondary hover:bg-background-tertiary'
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
      <div className="flex-shrink-0 flex border-t border-border p-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                <span className="text-sm font-medium">{getUserInitials()}</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-text dark:text-text">{getUserDisplayName()}</p>
              <p className="text-xs text-text-secondary dark:text-text-secondary">
                {userProfile?.email || session?.user?.email || 'No email'}
              </p>
              {isSuperAdmin && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                  <Shield className="h-3 w-3 mr-1" />
                  Super Admin
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1 rounded-full text-text-secondary hover:text-text"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}