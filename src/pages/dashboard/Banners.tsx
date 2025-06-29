import { useState } from 'react';
import { RefreshCw, Image, Plus, X } from 'lucide-react';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import BannerUploadForm from '@/components/BannerUploadForm';
import BannerDisplay from '@/components/BannerDisplay';
import BannerCarousel from '@/components/BannerCarousel';
import Card from '@/components/Card';

export default function Banners() {
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['banners']);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-text dark:text-text flex items-center gap-2">
            <Image className="h-6 w-6 text-primary flex-shrink-0" />
            <span className="truncate">Banner Management</span>
          </h1>
          <p className="text-text-secondary dark:text-text-secondary mt-1">
            Manage promotional banners displayed in the app
          </p>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
            disabled={refreshData.isPending}
            title="Refresh banners"
          >
            <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setIsAddingBanner(!isAddingBanner)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors
              ${isAddingBanner 
                ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                : 'bg-primary hover:bg-primary-dark text-white'
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
        </div>
      </div>

      {/* Upload Form */}
      {isAddingBanner && (
        <div className="mb-8">
          <BannerUploadForm />
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-8">
        {/* Banner Preview Section */}
        <Card title="Banner Preview (Carousel)" className="overflow-hidden">
          <div className="p-4">
            <p className="text-sm text-text-secondary dark:text-text-secondary mb-4">
              This is how your banners will appear to users on the dashboard:
            </p>
            <div className="w-full max-w-4xl mx-auto">
              <BannerCarousel />
            </div>
          </div>
        </Card>
        
        {/* Banner Management Section */}
        <BannerDisplay showAdminControls={true} />
      </div>
    </div>
  );
}