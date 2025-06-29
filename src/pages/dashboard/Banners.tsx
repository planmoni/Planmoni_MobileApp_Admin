import { useState } from 'react';
import { RefreshCw, Image, Plus } from 'lucide-react';
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text dark:text-text flex items-center gap-2">
            <Image className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Banner Management
          </h1>
          <p className="text-sm sm:text-base text-text-secondary dark:text-text-secondary mt-1">
            Manage promotional banners displayed in the app
          </p>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
            disabled={refreshData.isPending}
          >
            <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddingBanner(!isAddingBanner)}
            className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors text-sm sm:text-base"
          >
            {isAddingBanner ? (
              'Cancel'
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">Add Banner</span>
                <span className="xs:hidden">Add</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isAddingBanner && (
        <div className="mb-6 sm:mb-8">
          <BannerUploadForm />
        </div>
      )}

      <div className="space-y-6 sm:space-y-8">
        <Card title="Banner Preview (Carousel)" className="p-3 sm:p-4 lg:p-6">
          <p className="text-xs sm:text-sm text-text-secondary dark:text-text-secondary mb-3 sm:mb-4">
            This is how your banners will appear to users on the dashboard:
          </p>
          <div className="w-full">
            <BannerCarousel className="max-w-full" />
          </div>
        </Card>
        
        <div className="w-full">
          <BannerDisplay showAdminControls={true} />
        </div>
      </div>
    </div>
  );
}