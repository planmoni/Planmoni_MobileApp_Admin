import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, Mail, Check, ArrowRight } from 'lucide-react';
import Button from '../../components/Button';

export default function ForgotPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      showToast('Please enter your email address', 'error');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setIsEmailSent(true);
      showToast('Password reset email sent successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="flex min-h-full flex-col justify-center">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <img
            src="/assets/images/Planmoni-Office.png"
            alt="Planmoni Office"
            className="mx-auto h-20 w-auto"
            onError={(e) => {
              // Fallback to text if image fails to load
              e.currentTarget.style.display = 'none';
              const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextElement) {
                nextElement.style.display = 'block';
              }
            }}
          />
          <h1 className="text-xl font-bold text-primary text-center mt-2" style={{ display: 'none' }}>
            Planmoni Admin
          </h1>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-lg sm:rounded-lg sm:px-10 border border-border">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mb-6">
                <Check className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-text mb-4">Check your email</h2>
              <p className="text-center text-text-secondary mb-2">
                We've sent a password reset link to<br />
                <span className="font-semibold text-text">{email}</span>
              </p>
              <p className="text-center text-text-secondary mb-8">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
              
              <div className="w-full space-y-4">
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Back to Sign In
                </Button>
                <button
                  onClick={() => setIsEmailSent(false)}
                  className="w-full text-primary hover:underline text-sm font-medium"
                >
                  Try a different email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <img
          src="/assets/images/Planmoni-Office.png"
          alt="Planmoni Office"
          className="mx-auto h-20 w-auto"
          onError={(e) => {
            // Fallback to text if image fails to load
            e.currentTarget.style.display = 'none';
            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
            if (nextElement) {
              nextElement.style.display = 'block';
            }
          }}
        />
        <h1 className="text-xl font-bold text-primary text-center mt-2" style={{ display: 'none' }}>
          Planmoni Admin
        </h1>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 text-text">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Enter your email and we'll send you a link to reset your password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg sm:rounded-lg sm:px-10 border border-border">
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center text-text-secondary hover:text-text">
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to login
            </Link>
          </div>

          {error && (
            <div className="mb-6 rounded-md bg-error-light p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-error" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-error">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-text">
                Email Address
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  className="block w-full rounded-md border-0 py-3 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-border bg-white focus:ring-2 focus:ring-inset focus:ring-primary"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full flex justify-center items-center gap-2"
              isLoading={isLoading}
              disabled={isLoading}
              icon={!isLoading && <ArrowRight className="h-5 w-5" />}
            >
              Send Reset Link
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-primary hover:underline text-sm font-medium">
                Remember your password? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}