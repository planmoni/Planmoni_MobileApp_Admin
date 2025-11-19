import { useState } from 'react';
import { Shield, Copy, Check, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { TOTP } from 'otpauth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import Button from './Button';

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onToggle: () => void;
}

export function TwoFactorSetup({ isEnabled, onToggle }: TwoFactorSetupProps) {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { showToast } = useToast();

  const generateSecret = () => {
    const totp = new TOTP({
      issuer: 'Planmoni Admin',
      label: 'admin@planmoni.com',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    return totp.secret.base32;
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const handleStartSetup = async () => {
    try {
      const newSecret = generateSecret();
      const newBackupCodes = generateBackupCodes();

      setSecret(newSecret);
      setBackupCodes(newBackupCodes);

      const totp = new TOTP({
        issuer: 'Planmoni Admin',
        label: 'admin@planmoni.com',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: newSecret,
      });

      const otpauthUrl = totp.toString();
      const qrCode = await QRCode.toDataURL(otpauthUrl);
      setQrCodeUrl(qrCode);
      setIsSetupMode(true);
    } catch (error) {
      console.error('Error generating 2FA setup:', error);
      showToast('Failed to generate 2FA setup', 'error');
    }
  };

  const handleVerifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showToast('Please enter a 6-digit code', 'error');
      return;
    }

    setIsVerifying(true);
    try {
      const totp = new TOTP({
        issuer: 'Planmoni Admin',
        label: 'admin@planmoni.com',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: secret,
      });

      const isValid = totp.validate({ token: verificationCode, window: 1 }) !== null;

      if (!isValid) {
        showToast('Invalid verification code. Please try again.', 'error');
        setIsVerifying(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('admin_2fa_settings')
        .upsert({
          user_id: user.id,
          secret: secret,
          is_enabled: true,
          backup_codes: backupCodes,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      showToast('Two-factor authentication enabled successfully', 'success');
      setIsSetupMode(false);
      setVerificationCode('');
      onToggle();
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      showToast('Failed to enable 2FA', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('admin_2fa_settings')
        .update({ is_enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      showToast('Two-factor authentication disabled', 'success');
      onToggle();
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      showToast('Failed to disable 2FA', 'error');
    }
  };

  const copyToClipboard = (text: string, type: 'secret' | 'backup') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    }
  };

  if (!isSetupMode && !isEnabled) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Two-Factor Authentication
            </h3>
            <p className="text-gray-600 mb-4">
              Add an extra layer of security to your admin account by requiring a verification code from your authenticator app.
            </p>
            <Button onClick={handleStartSetup} variant="primary">
              Enable 2FA
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSetupMode) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Setup Two-Factor Authentication
        </h3>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            {qrCodeUrl && (
              <div className="flex justify-center p-4 bg-gray-50 rounded-xl">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or enter this secret key manually:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={secret}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(secret, 'secret')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copiedSecret ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-900 mb-2">Backup Codes</h4>
                <p className="text-sm text-yellow-800 mb-3">
                  Save these backup codes in a secure place. Each code can be used once if you lose access to your authenticator app.
                </p>
                <div className="bg-white rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="text-gray-700">{code}</div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(backupCodes.join('\n'), 'backup')}
                  className="text-sm text-yellow-700 hover:text-yellow-800 font-medium flex items-center gap-2"
                >
                  {copiedBackup ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy all codes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter the 6-digit code from your app to verify:
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg text-center tracking-widest"
              maxLength={6}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleVerifyAndEnable}
              variant="primary"
              disabled={isVerifying || verificationCode.length !== 6}
              className="flex-1"
            >
              {isVerifying ? 'Verifying...' : 'Verify and Enable'}
            </Button>
            <Button
              onClick={() => setIsSetupMode(false)}
              variant="secondary"
              disabled={isVerifying}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Two-Factor Authentication
            </h3>
            <p className="text-green-600 font-medium mb-1">Enabled</p>
            <p className="text-sm text-gray-600">
              Your account is protected with two-factor authentication.
            </p>
          </div>
        </div>
        <Button onClick={handleDisable} variant="secondary" className="text-red-600 hover:bg-red-50">
          Disable
        </Button>
      </div>
    </div>
  );
}
