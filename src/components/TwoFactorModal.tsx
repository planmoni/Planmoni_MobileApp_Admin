import { useState } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import Button from './Button';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  isVerifying: boolean;
}

export function TwoFactorModal({ isOpen, onClose, onVerify, isVerifying }: TwoFactorModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setError('');
    try {
      await onVerify(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleClose = () => {
    setCode('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} />

        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 transform transition-all">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isVerifying}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Two-Factor Authentication
            </h2>
            <p className="text-gray-600 text-center text-sm">
              Enter the 6-digit code from your Google Authenticator app
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-semibold text-gray-900 mb-2">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-2xl text-center tracking-widest"
                maxLength={6}
                autoFocus
                disabled={isVerifying}
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Contact your system administrator if you need backup codes
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleClose}
                variant="secondary"
                className="flex-1"
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={isVerifying || code.length !== 6}
              >
                {isVerifying ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
