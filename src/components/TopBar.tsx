import { useState, useEffect } from 'react';
import { Search, LogOut, Shield, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}

export default function TopBar({ isMobileMenuOpen, toggleMobileMenu }: TopBarProps) {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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
      } else {
        setIsSuperAdmin(false);
      }
    } catch (error) {
      console.error('Error checking super admin status:', error);
      setIsSuperAdmin(false);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/users?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center flex-1 gap-4">
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="block w-full pl-10 pr-4 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white shadow-sm">
              <span className="text-sm font-semibold">{getUserInitials()}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">
                  {userProfile?.email || session?.user?.email || 'No email'}
                </p>
                {isSuperAdmin && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                    <Shield className="h-3 w-3 mr-0.5" />
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
