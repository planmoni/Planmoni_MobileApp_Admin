import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Shield, Bell, Database, Key, LogOut, Image } from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import BannerUploadForm from '../../components/BannerUploadForm';
import BannerDisplay from '../../components/BannerDisplay';

export default function Settings() {
  const { signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dataBackupEnabled, setDataBackupEnabled] = useState(true);
  const [enhancedSecurityEnabled, setEnhancedSecurityEnabled] = useState(true);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-text-secondary">Configure admin dashboard settings</p>
      </div>

      <div className="space-y-8">
        {/* Banner Management Section */}
        <div>
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
            <Image className="h-5 w-5" />
            Banner Management
          </h2>
          <div className="space-y-6">
            <BannerUploadForm />
            <BannerDisplay showAdminControls={true} />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text mb-4">Notifications</h2>
          <Card className="overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center mr-4">
                  <Bell className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-text font-medium">Admin Notifications</p>
                  <p className="text-sm text-text-secondary">Receive alerts for important events</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={notificationsEnabled}
                  onChange={() => setNotificationsEnabled(!notificationsEnabled)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text mb-4">Security</h2>
          <Card className="overflow-hidden divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mr-4">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-text font-medium">Enhanced Security</p>
                  <p className="text-sm text-text-secondary">Additional security measures for admin actions</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={enhancedSecurityEnabled}
                  onChange={() => setEnhancedSecurityEnabled(!enhancedSecurityEnabled)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center mr-4">
                  <Key className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <p className="text-text font-medium">API Keys</p>
                  <p className="text-sm text-text-secondary">Manage API access keys</p>
                </div>
              </div>
              <button className="px-3 py-1.5 text-sm text-primary bg-background-tertiary rounded hover:bg-background-secondary transition-colors">
                Manage
              </button>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text mb-4">Data Management</h2>
          <Card className="overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-4">
                  <Database className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-text font-medium">Automated Backups</p>
                  <p className="text-sm text-text-secondary">Schedule regular database backups</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={dataBackupEnabled}
                  onChange={() => setDataBackupEnabled(!dataBackupEnabled)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </Card>
        </div>

        <div>
          <Button
            onClick={handleSignOut}
            className="w-full bg-red-500 hover:bg-red-600 focus:ring-red-500"
            icon={<LogOut className="h-5 w-5" />}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}