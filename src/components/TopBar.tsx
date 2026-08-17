import { useState, useEffect, useRef } from 'react';
import { Search, User, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
}

interface UserSuggestion {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
}

export default function TopBar({ isMobileMenuOpen, toggleMobileMenu }: TopBarProps) {
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    is_admin: boolean;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session?.user) {
      fetchUserProfile();
      checkSuperAdminStatus();
    }
  }, [session?.user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const searchTerms = searchQuery.trim().split(/\s+/).filter(Boolean);

        let profilesQuery = supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            email,
            kyc_data!inner(phone_number)
          `);

        for (const term of searchTerms) {
          const searchTerm = `%${term}%`;
          profilesQuery = profilesQuery.or(
            `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},kyc_data.phone_number.ilike.${searchTerm}`
          );
        }

        const { data, error } = await profilesQuery;

        if (!error && data) {
          const suggestions = data.map(user => ({
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: Array.isArray(user.kyc_data) && user.kyc_data.length > 0
              ? user.kyc_data[0].phone_number
              : null
          }));

          setSuggestions(suggestions);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        } else if (error) {
          let profilesOnlyQuery = supabase
            .from('profiles')
            .select('id, first_name, last_name, email');

          for (const term of searchTerms) {
            const searchTerm = `%${term}%`;
            profilesOnlyQuery = profilesOnlyQuery.or(
              `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`
            );
          }

          const { data: profilesOnly } = await profilesOnlyQuery;

          if (profilesOnly) {
            const suggestions = profilesOnly.map(user => ({
              id: user.id,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              phone: null
            }));

            setSuggestions(suggestions);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }
        }
      } catch (error) {
        console.error('Error searching users:', error);
      }
    };

    const debounceTimeout = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

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
    setIsDropdownOpen(false);
    await signOut();
  };

  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    navigate('/settings');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate(`/users?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSuggestionClick = (userId: string) => {
    setShowSuggestions(false);
    setSearchQuery('');
    navigate(`/users/${userId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[selectedIndex].id);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const getUserFullName = (user: UserSuggestion) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    return user.email.split('@')[0];
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="font-semibold text-blue-600">{part}</span>
      ) : (
        part
      )
    );
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

  const getUserRole = () => {
    if (isSuperAdmin) {
      return 'Super Admin';
    }
    if (userProfile?.is_admin) {
      return 'Admin';
    }
    return 'User';
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
            <div className="relative" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="Search users..."
                className="block w-full pl-10 pr-4 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoComplete="off"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-96 overflow-y-auto">
                  {suggestions.map((user, index) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSuggestionClick(user.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                        index === selectedIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center text-white flex-shrink-0">
                        <span className="text-sm font-semibold">
                          {user.first_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                          {user.last_name?.[0]?.toUpperCase() || ''}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {highlightMatch(getUserFullName(user), searchQuery)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {highlightMatch(user.email, searchQuery)}
                        </p>
                        {user.phone && (
                          <p className="text-xs text-gray-400 truncate">
                            {highlightMatch(user.phone, searchQuery)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                    {suggestions.length} result{suggestions.length === 1 ? '' : 's'}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm">
                <span className="text-sm font-semibold">{getUserInitials()}</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">{getUserDisplayName()}</p>
                <p className="text-xs text-gray-500">{getUserRole()}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={handleProfileClick}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
