import { useState } from 'react';
import { RefreshCw, Plus, X } from 'lucide-react';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { usePermissions } from '@/contexts/PermissionsContext';
import BannerUploadForm from '@/components/BannerUploadForm';
import BannerDisplay from '@/components/BannerDisplay';

export default function Banners() {
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const refreshData = useRefreshData();
  const { hasPermission, isSuperAdmin } = usePermissions();

  const handleRefresh = () => {
    refreshData.mutate(['banners']);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Banner Management</h1>
          <p className="text-gray-500">
            Manage promotional banners displayed in the app
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleRefresh}
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-100"
            disabled={refreshData.isPending}
            title="Refresh banners"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>

          {(isSuperAdmin || hasPermission('banners', 'create')) && (
            <button
              onClick={() => setIsAddingBanner(!isAddingBanner)}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all shadow-soft
                ${isAddingBanner
                  ? 'bg-gray-500 hover:bg-gray-600 text-white'
                  : 'bg-gray-900 hover:bg-gray-800 text-white'
                }
              `}
            >
              {isAddingBanner ? (
                <>
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Banner</span>
                  <span className="sm:hidden">Add</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {isAddingBanner && (
        <div className="mb-8">
          <BannerUploadForm />
        </div>
      )}

      <div className="space-y-8">
        {/* <div className="bg-white rounded-2xl p-4 md:p-6 border border-gray-100">
          <div className="mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-gray-900">Banner Preview</h3>
            <p className="text-sm text-gray-500 mt-1">
              This is how your banners will appear to users on the dashboard
            </p>
          </div>
          <div className="w-full md:max-w-2xl md:mx-auto">
            <BannerCarousel maxHeight="max-h-48 sm:max-h-56" />
          </div>
        </div> */}

        <BannerDisplay showAdminControls={true} />
      </div>
    </div>
  );
}