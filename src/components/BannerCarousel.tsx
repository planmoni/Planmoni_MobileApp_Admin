import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBanners } from '@/hooks/queries/useBanners';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface BannerCarouselProps {
  className?: string;
  maxHeight?: string;
  showControls?: boolean;
}

export default function BannerCarousel({ 
  className = '', 
  maxHeight = 'max-h-64',
  showControls = true 
}: BannerCarouselProps) {
  const { data: banners, isLoading, error } = useBanners(true);
  const [swiperInitialized, setSwiperInitialized] = useState(false);

  useEffect(() => {
    // This effect is used to force a Swiper update when banners data changes
    if (banners && banners.length > 0 && swiperInitialized) {
      const swiperInstance = (document.querySelector('.banner-carousel .swiper') as any)?.swiper;
      if (swiperInstance) {
        swiperInstance.update();
      }
    }
  }, [banners, swiperInitialized]);

  if (isLoading) {
    return (
      <div className={`flex justify-center items-center h-32 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !banners || banners.length === 0) {
    return null; // Don't show anything if there's an error or no banners
  }

  const renderBannerContent = (banner: any) => {
    const bannerElement = (
      <div className="relative w-full h-full">
        <div className={`w-full ${maxHeight} overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}>
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-contain transition-transform duration-300 hover:scale-105"
            style={{ maxHeight: '100%', maxWidth: '100%' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
            }}
          />
        </div>
        
        {(banner.title || banner.description) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 sm:p-4 rounded-b-lg">
            {banner.title && (
              <h3 className="text-white text-sm sm:text-base font-semibold mb-1 line-clamp-1 drop-shadow-sm">
                {banner.title}
              </h3>
            )}
            {banner.description && (
              <p className="text-white/90 text-xs sm:text-sm line-clamp-2 drop-shadow-sm">
                {banner.description}
              </p>
            )}
            {banner.cta_text && (
              <div className="mt-2">
                <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium border border-white/20">
                  {banner.cta_text}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );

    // If no link URL, just return the image
    if (!banner.link_url) {
      return bannerElement;
    }

    // Check if it's an external URL
    const isExternalUrl = banner.link_url.startsWith('http://') || banner.link_url.startsWith('https://');

    if (isExternalUrl) {
      return (
        <a
          href={banner.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block cursor-pointer h-full"
        >
          {bannerElement}
        </a>
      );
    } else {
      return (
        <Link to={banner.link_url} className="block cursor-pointer h-full">
          {bannerElement}
        </Link>
      );
    }
  };

  return (
    <div className={`relative banner-carousel ${className}`}>
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={16}
        slidesPerView={1}
        navigation={showControls ? {
          nextEl: '.banner-carousel .swiper-button-next',
          prevEl: '.banner-carousel .swiper-button-prev',
        } : false}
        pagination={showControls ? { 
          clickable: true,
          el: '.banner-carousel .swiper-pagination',
          bulletClass: 'swiper-pagination-bullet !bg-white/60 !opacity-100',
          bulletActiveClass: 'swiper-pagination-bullet-active !bg-white !scale-125',
        } : false}
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={banners.length > 1}
        onInit={() => setSwiperInitialized(true)}
        className="rounded-lg overflow-hidden"
        style={{ height: 'auto' }}
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.id} className="!h-auto">
            {renderBannerContent(banner)}
          </SwiperSlide>
        ))}
      </Swiper>
      
      {banners.length > 1 && showControls && (
        <>
          {/* Previous Button */}
          <div className="swiper-button-prev !hidden sm:!flex absolute left-3 top-1/2 transform -translate-y-1/2 z-20 items-center justify-center w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110 group">
            <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
          </div>
          
          {/* Next Button */}
          <div className="swiper-button-next !hidden sm:!flex absolute right-3 top-1/2 transform -translate-y-1/2 z-20 items-center justify-center w-12 h-12 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110 group">
            <ChevronRight className="h-6 w-6 text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
          </div>
          
          {/* Mobile Navigation Dots */}
          <div className="swiper-pagination !relative !bottom-0 !top-4 flex justify-center gap-2 sm:!absolute sm:!bottom-4 sm:!top-auto"></div>
        </>
      )}
      
      {/* Custom styles for pagination */}
      <style>{`
        .banner-carousel .swiper-pagination-bullet {
          width: 8px !important;
          height: 8px !important;
          margin: 0 4px !important;
          border-radius: 50% !important;
          transition: all 0.3s ease !important;
        }
        
        .banner-carousel .swiper-pagination-bullet-active {
          transform: scale(1.25) !important;
        }
        
        @media (max-width: 640px) {
          .banner-carousel .swiper-pagination {
            position: relative !important;
            bottom: auto !important;
            top: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}