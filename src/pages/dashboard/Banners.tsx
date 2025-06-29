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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center mb-6">
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text dark:text-text flex items-center gap-2">
            <Image className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-primary" />
            Banner Management
          </h1>
          <p className="text-sm sm:text-base text-text-secondary dark:text-text-secondary mt-1">
            Manage promotional banners displayed in the app
          </p>
        </div>
        
        {/* Action buttons container */}
        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
          {/* Refresh button */}
          <button 
            onClick={handleRefresh}
            className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
            disabled={refreshData.isPending}
            title="Refresh banners"
          >
            <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Add/Cancel button - Responsive design */}
          <button
            onClick={() => setIsAddingBanner(!isAddingBanner)}
            className={`
              flex items-center justify-center gap-2 
              px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6 lg:py-3
              rounded-md font-medium transition-all duration-200
              text-sm sm:text-base
              min-w-[80px] sm:min-w-[100px] lg:min-w-[120px]
              ${isAddingBanner 
                ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                : 'bg-primary hover:bg-primary-dark text-white hover:shadow-lg transform hover:scale-105'
              }
            `}
          >
            {isAddingBanner ? (
              <>
                <X className="h-4 w-4" />
                <span className="hidden xs:inline">Cancel</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {/* Responsive text display */}
                <span className="hidden xs:inline sm:hidden">Add</span>
                <span className="hidden sm:inline lg:hidden">Add Banner</span>
                <span className="hidden lg:inline">Add New Banner</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Upload form with responsive spacing */}
      {isAddingBanner && (
        <div className="mb-6 sm:mb-8 animate-in slide-in-from-top-2 duration-300">
          <BannerUploadForm />
        </div>
      )}

      {/* Main content with responsive spacing */}
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