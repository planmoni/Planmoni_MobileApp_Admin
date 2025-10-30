import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, Shield } from 'lucide-react';
import { TOTP } from 'otpauth';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setError(result.error || 'Failed to sign in');
        showToast(result.error || 'Failed to sign in', 'error');
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No user found after login');
      }

      const { data: globalTwoFactorSettings } = await supabase
        .from('admin_2fa_settings')
        .select('is_enabled')
        .eq('is_enabled', true)
        .limit(1)
        .maybeSingle();

      if (globalTwoFactorSettings) {
        setRequires2FA(true);
        setIsLoading(false);
        await supabase.auth.signOut();
        return;
      }

      await createSession(user.id);
      navigate('/');
      showToast('Successfully signed in', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setError('Session expired. Please login again.');
        setRequires2FA(false);
        setTwoFactorCode('');
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data: twoFactorSettings } = await supabase
        .from('admin_2fa_settings')
        .select('secret, backup_codes, user_id')
        .eq('is_enabled', true)
        .limit(1)
        .single();

      if (!twoFactorSettings) {
        throw new Error('2FA settings not found');
      }

      const totp = new TOTP({
        issuer: 'Planmoni Admin',
        label: 'admin@planmoni.com',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: twoFactorSettings.secret,
      });

      const isValid = totp.validate({ token: twoFactorCode, window: 1 }) !== null;
      const isBackupCode = twoFactorSettings.backup_codes?.includes(twoFactorCode);

      if (!isValid && !isBackupCode) {
        setError('Invalid verification code. Please try again.');
        setIsLoading(false);
        return;
      }

      if (isBackupCode) {
        const updatedCodes = twoFactorSettings.backup_codes.filter((code: string) => code !== twoFactorCode);
        await supabase
          .from('admin_2fa_settings')
          .update({ backup_codes: updatedCodes })
          .eq('user_id', twoFactorSettings.user_id);
        showToast('Backup code used successfully', 'success');
      }

      await createSession(user.id);
      navigate('/');
      showToast('Successfully signed in', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = async (userId: string) => {
    try {
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await supabase.from('admin_sessions').insert({
        user_id: userId,
        session_token: sessionToken,
        ip_address: null,
        user_agent: navigator.userAgent,
        expires_at: expiresAt.toISOString(),
      });

      localStorage.setItem('admin_session_token', sessionToken);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  return (
    <div className="min-h-screen flex">

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img
              src="/assets/images/planmoni_logo_main.png"
              alt="Planmoni"
              className="h-12 w-auto mx-auto mb-4"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {requires2FA ? 'Two-Factor Authentication' : 'Sign in'}
              </h2>
              <p className="text-gray-500">
                {requires2FA
                  ? 'This system requires two-factor authentication. Enter the 6-digit code from the authenticator app.'
                  : 'Enter your credentials to access your account'}
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-100 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {requires2FA ? (
              <form className="space-y-5" onSubmit={handleVerify2FA}>
                <div>
                  <label htmlFor="twoFactorCode" className="block text-sm font-semibold text-gray-900 mb-2">
                    Verification Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <Shield className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="twoFactorCode"
                      name="twoFactorCode"
                      type="text"
                      autoComplete="off"
                      required
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="block w-full pl-11 pr-4 py-3.5 text-gray-900 bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-lg tracking-widest text-center"
                      placeholder="000000"
                      maxLength={6}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Contact your system administrator if you need access to backup codes
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || twoFactorCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 bg-[#000] hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                    setError(null);
                  }}
                  className="w-full text-center text-sm text-gray-600 hover:text-gray-900 py-2"
                >
                  Back to login
                </button>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 text-gray-900 bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3.5 text-gray-900 bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#000] hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}