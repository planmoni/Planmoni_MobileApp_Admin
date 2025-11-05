import { useState, useEffect } from 'react';
import { RefreshCw, Smartphone, Save, AlertTriangle } from 'lucide-react';
import { useAppVersions } from '@/hooks/queries/useAppVersions';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';

export default function AppVersions() {
  const { data: versions, isLoading, error } = useAppVersions();
  const refreshData = useRefreshData();
  const { showToast } = useToast();

  const activeVersion = versions?.find(v => v.is_active);

  const [androidData, setAndroidData] = useState({
    version: '',
    build: '',
    updateUrl: '',
    forceUpdate: false,
  });

  const [iosData, setIosData] = useState({
    version: '',
    build: '',
    updateUrl: '',
    forceUpdate: false,
  });

  const [updateMessage, setUpdateMessage] = useState('');
  const [isUpdatingAndroid, setIsUpdatingAndroid] = useState(false);
  const [isUpdatingIos, setIsUpdatingIos] = useState(false);
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);

  useEffect(() => {
    if (activeVersion) {
      setAndroidData({
        version: activeVersion.android_version,
        build: activeVersion.android_build.toString(),
        updateUrl: activeVersion.android_update_url || '',
        forceUpdate: activeVersion.force_update,
      });
      setIosData({
        version: activeVersion.ios_version,
        build: activeVersion.ios_build.toString(),
        updateUrl: activeVersion.ios_update_url || '',
        forceUpdate: activeVersion.force_update,
      });
      setUpdateMessage(activeVersion.update_message || '');
    }
  }, [activeVersion]);

  const handleRefresh = () => {
    refreshData.mutate(['app-versions']);
  };

  const handleUpdateAndroid = async () => {
    if (!activeVersion) return;
    setIsUpdatingAndroid(true);

    try {
      const { error } = await supabase
        .from('app_versions')
        .update({
          android_version: androidData.version,
          android_build: parseInt(androidData.build),
          android_update_url: androidData.updateUrl || null,
          force_update: androidData.forceUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeVersion.id);

      if (error) throw error;

      showToast('Android version updated successfully', 'success');
      refreshData.mutate(['app-versions']);
    } catch (error) {
      console.error('Error updating Android version:', error);
      showToast('Failed to update Android version', 'error');
    } finally {
      setIsUpdatingAndroid(false);
    }
  };

  const handleUpdateIos = async () => {
    if (!activeVersion) return;
    setIsUpdatingIos(true);

    try {
      const { error } = await supabase
        .from('app_versions')
        .update({
          ios_version: iosData.version,
          ios_build: parseInt(iosData.build),
          ios_update_url: iosData.updateUrl || null,
          force_update: iosData.forceUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeVersion.id);

      if (error) throw error;

      showToast('iOS version updated successfully', 'success');
      refreshData.mutate(['app-versions']);
    } catch (error) {
      console.error('Error updating iOS version:', error);
      showToast('Failed to update iOS version', 'error');
    } finally {
      setIsUpdatingIos(false);
    }
  };

  const handleUpdateMessage = async () => {
    if (!activeVersion) return;
    setIsUpdatingMessage(true);

    try {
      const { error } = await supabase
        .from('app_versions')
        .update({
          update_message: updateMessage || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeVersion.id);

      if (error) throw error;

      showToast('Update message saved successfully', 'success');
      refreshData.mutate(['app-versions']);
    } catch (error) {
      console.error('Error updating message:', error);
      showToast('Failed to update message', 'error');
    } finally {
      setIsUpdatingMessage(false);
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load app versions</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!activeVersion) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-gray-700 mb-2">No active version found</p>
        <p className="text-gray-500 text-sm">Please create a version and set it as active</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">App Versions</h1>
          <p className="text-gray-500 mt-1">Manage mobile application versions independently</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Android</h2>
                <p className="text-sm opacity-90">Play Store Version</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version Number
              </label>
              <input
                type="text"
                value={androidData.version}
                onChange={(e) => setAndroidData({ ...androidData, version: e.target.value })}
                placeholder="1.0.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Build Number
              </label>
              <input
                type="number"
                value={androidData.build}
                onChange={(e) => setAndroidData({ ...androidData, build: e.target.value })}
                placeholder="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Play Store URL
              </label>
              <input
                type="url"
                value={androidData.updateUrl}
                onChange={(e) => setAndroidData({ ...androidData, updateUrl: e.target.value })}
                placeholder="https://play.google.com/store/apps/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={androidData.forceUpdate}
                  onChange={(e) => setAndroidData({ ...androidData, forceUpdate: e.target.checked })}
                  className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Force Update Required</span>
              </label>
            </div>

            <button
              onClick={handleUpdateAndroid}
              disabled={isUpdatingAndroid}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{isUpdatingAndroid ? 'Updating...' : 'Update Android Version'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">iOS</h2>
                <p className="text-sm opacity-90">App Store Version</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Version Number
              </label>
              <input
                type="text"
                value={iosData.version}
                onChange={(e) => setIosData({ ...iosData, version: e.target.value })}
                placeholder="1.0.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Build Number
              </label>
              <input
                type="number"
                value={iosData.build}
                onChange={(e) => setIosData({ ...iosData, build: e.target.value })}
                placeholder="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                App Store URL
              </label>
              <input
                type="url"
                value={iosData.updateUrl}
                onChange={(e) => setIosData({ ...iosData, updateUrl: e.target.value })}
                placeholder="https://apps.apple.com/app/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={iosData.forceUpdate}
                  onChange={(e) => setIosData({ ...iosData, forceUpdate: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Force Update Required</span>
              </label>
            </div>

            <button
              onClick={handleUpdateIos}
              disabled={isUpdatingIos}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{isUpdatingIos ? 'Updating...' : 'Update iOS Version'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Message</h3>
        <p className="text-sm text-gray-500 mb-4">
          This message will be displayed to users when they need to update the app
        </p>
        <textarea
          rows={4}
          value={updateMessage}
          onChange={(e) => setUpdateMessage(e.target.value)}
          placeholder="Enter update message for users..."
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
        />
        <button
          onClick={handleUpdateMessage}
          disabled={isUpdatingMessage}
          className="mt-4 flex items-center space-x-2 px-6 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          <span>{isUpdatingMessage ? 'Saving...' : 'Save Message'}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Android
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  iOS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Force Update
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {versions?.map((version) => (
                <tr key={version.id} className={version.is_active ? 'bg-green-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">v{version.android_version}</p>
                      <p className="text-xs text-gray-500">Build {version.android_build}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">v{version.ios_version}</p>
                      <p className="text-xs text-gray-500">Build {version.ios_build}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {version.force_update ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {version.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(version.updated_at), 'MMM dd, yyyy HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
