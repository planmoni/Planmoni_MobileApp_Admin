import { useState } from 'react';
import { RefreshCw, Smartphone, Plus, Edit, Check, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAppVersions, AppVersion } from '@/hooks/queries/useAppVersions';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { format } from 'date-fns';

export default function AppVersions() {
  const { data: versions, isLoading, error } = useAppVersions();
  const refreshData = useRefreshData();
  const { showToast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(null);

  const handleRefresh = () => {
    refreshData.mutate(['app-versions']);
  };

  const activeVersion = versions?.find(v => v.is_active);

  const handleToggleActive = async (versionId: string, currentStatus: boolean) => {
    try {
      if (!currentStatus) {
        await supabase
          .from('app_versions')
          .update({ is_active: false })
          .neq('id', versionId);
      }

      const { error } = await supabase
        .from('app_versions')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', versionId);

      if (error) throw error;

      showToast('Version status updated successfully', 'success');
      refreshData.mutate(['app-versions']);
    } catch (error) {
      console.error('Error updating version status:', error);
      showToast('Failed to update version status', 'error');
    }
  };

  const handleEdit = (version: AppVersion) => {
    setSelectedVersion(version);
    setShowEditModal(true);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">App Versions</h1>
          <p className="text-gray-500 mt-1">Manage mobile application versions</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Version</span>
          </button>
        </div>
      </div>

      {activeVersion && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm opacity-90">Android</p>
                  <p className="text-2xl font-bold">v{activeVersion.android_version}</p>
                </div>
              </div>
              {activeVersion.force_update && (
                <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <p className="text-xs font-semibold">Force Update</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-90">Build Number:</span>
                <span className="font-semibold">{activeVersion.android_build}</span>
              </div>
              {activeVersion.android_update_url && (
                <a
                  href={activeVersion.android_update_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm hover:underline"
                >
                  <span>View in Play Store</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm opacity-90">iOS</p>
                  <p className="text-2xl font-bold">v{activeVersion.ios_version}</p>
                </div>
              </div>
              {activeVersion.force_update && (
                <div className="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <p className="text-xs font-semibold">Force Update</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="opacity-90">Build Number:</span>
                <span className="font-semibold">{activeVersion.ios_build}</span>
              </div>
              {activeVersion.ios_update_url && (
                <a
                  href={activeVersion.ios_update_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-sm hover:underline"
                >
                  <span>View in App Store</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {activeVersion?.update_message && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">Update Message</p>
              <p className="text-sm text-amber-800">{activeVersion.update_message}</p>
            </div>
          </div>
        </div>
      )}

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
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {versions?.map((version) => (
                <tr key={version.id} className="hover:bg-gray-50 transition-colors">
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
                    <button
                      onClick={() => handleToggleActive(version.id, version.is_active)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        version.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {version.is_active ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(version.created_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleEdit(version)}
                      className="text-accent hover:text-accent-dark transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddVersionModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refreshData.mutate(['app-versions']);
          }}
        />
      )}

      {showEditModal && selectedVersion && (
        <EditVersionModal
          version={selectedVersion}
          onClose={() => {
            setShowEditModal(false);
            setSelectedVersion(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedVersion(null);
            refreshData.mutate(['app-versions']);
          }}
        />
      )}
    </div>
  );
}

function AddVersionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    android_version: '',
    ios_version: '',
    android_build: '',
    ios_build: '',
    android_update_url: '',
    ios_update_url: '',
    update_message: '',
    force_update: false,
    is_active: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (formData.is_active) {
        await supabase
          .from('app_versions')
          .update({ is_active: false })
          .neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { error } = await supabase.from('app_versions').insert([
        {
          android_version: formData.android_version,
          ios_version: formData.ios_version,
          android_build: parseInt(formData.android_build),
          ios_build: parseInt(formData.ios_build),
          android_update_url: formData.android_update_url || null,
          ios_update_url: formData.ios_update_url || null,
          update_message: formData.update_message || null,
          force_update: formData.force_update,
          is_active: formData.is_active,
        },
      ]);

      if (error) throw error;

      showToast('Version added successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error adding version:', error);
      showToast('Failed to add version', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Add New Version</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Android Version
              </label>
              <input
                type="text"
                required
                placeholder="1.0.0"
                value={formData.android_version}
                onChange={(e) => setFormData({ ...formData, android_version: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Android Build Number
              </label>
              <input
                type="number"
                required
                placeholder="1"
                value={formData.android_build}
                onChange={(e) => setFormData({ ...formData, android_build: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                iOS Version
              </label>
              <input
                type="text"
                required
                placeholder="1.0.0"
                value={formData.ios_version}
                onChange={(e) => setFormData({ ...formData, ios_version: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                iOS Build Number
              </label>
              <input
                type="number"
                required
                placeholder="1"
                value={formData.ios_build}
                onChange={(e) => setFormData({ ...formData, ios_build: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Android Update URL
            </label>
            <input
              type="url"
              placeholder="https://play.google.com/store/apps/..."
              value={formData.android_update_url}
              onChange={(e) => setFormData({ ...formData, android_update_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              iOS Update URL
            </label>
            <input
              type="url"
              placeholder="https://apps.apple.com/app/..."
              value={formData.ios_update_url}
              onChange={(e) => setFormData({ ...formData, ios_update_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Message
            </label>
            <textarea
              rows={3}
              placeholder="Enter update message for users..."
              value={formData.update_message}
              onChange={(e) => setFormData({ ...formData, update_message: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.force_update}
                onChange={(e) => setFormData({ ...formData, force_update: e.target.checked })}
                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
              />
              <span className="text-sm text-gray-700">Force Update</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
              />
              <span className="text-sm text-gray-700">Set as Active</span>
            </label>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditVersionModal({
  version,
  onClose,
  onSuccess,
}: {
  version: AppVersion;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    android_version: version.android_version,
    ios_version: version.ios_version,
    android_build: version.android_build.toString(),
    ios_build: version.ios_build.toString(),
    android_update_url: version.android_update_url || '',
    ios_update_url: version.ios_update_url || '',
    update_message: version.update_message || '',
    force_update: version.force_update,
    is_active: version.is_active,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (formData.is_active && !version.is_active) {
        await supabase
          .from('app_versions')
          .update({ is_active: false })
          .neq('id', version.id);
      }

      const { error } = await supabase
        .from('app_versions')
        .update({
          android_version: formData.android_version,
          ios_version: formData.ios_version,
          android_build: parseInt(formData.android_build),
          ios_build: parseInt(formData.ios_build),
          android_update_url: formData.android_update_url || null,
          ios_update_url: formData.ios_update_url || null,
          update_message: formData.update_message || null,
          force_update: formData.force_update,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', version.id);

      if (error) throw error;

      showToast('Version updated successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error updating version:', error);
      showToast('Failed to update version', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Edit Version</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Android Version
              </label>
              <input
                type="text"
                required
                placeholder="1.0.0"
                value={formData.android_version}
                onChange={(e) => setFormData({ ...formData, android_version: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Android Build Number
              </label>
              <input
                type="number"
                required
                placeholder="1"
                value={formData.android_build}
                onChange={(e) => setFormData({ ...formData, android_build: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                iOS Version
              </label>
              <input
                type="text"
                required
                placeholder="1.0.0"
                value={formData.ios_version}
                onChange={(e) => setFormData({ ...formData, ios_version: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                iOS Build Number
              </label>
              <input
                type="number"
                required
                placeholder="1"
                value={formData.ios_build}
                onChange={(e) => setFormData({ ...formData, ios_build: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Android Update URL
            </label>
            <input
              type="url"
              placeholder="https://play.google.com/store/apps/..."
              value={formData.android_update_url}
              onChange={(e) => setFormData({ ...formData, android_update_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              iOS Update URL
            </label>
            <input
              type="url"
              placeholder="https://apps.apple.com/app/..."
              value={formData.ios_update_url}
              onChange={(e) => setFormData({ ...formData, ios_update_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Message
            </label>
            <textarea
              rows={3}
              placeholder="Enter update message for users..."
              value={formData.update_message}
              onChange={(e) => setFormData({ ...formData, update_message: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.force_update}
                onChange={(e) => setFormData({ ...formData, force_update: e.target.checked })}
                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
              />
              <span className="text-sm text-gray-700">Force Update</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
              />
              <span className="text-sm text-gray-700">Set as Active</span>
            </label>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
