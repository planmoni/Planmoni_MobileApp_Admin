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
}

export default function BannerCarousel({ className = '' }: BannerCarouselProps) {
  const { data: banners, isLoading, error } = useBanners(true);
  const [swiperInitialized, setSwiperInitialized] = useState(false);

  useEffect(() => {
    // This effect is used to force a Swiper update when banners data changes
    if (banners && banners.length > 0 && swiperInitialized) {
      const swiperInstance = document.querySelector('.swiper')?.swiper;
      if (swiperInstance) {
        swiperInstance.update();
      }
    }
  }, [banners, swiperInitialized]);

  if (isLoading) {
    return (
      <div className={`flex justify-center items-center h-48 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !banners || banners.length === 0) {
    return null; // Don't show anything if there's an error or no banners
  }

  const renderBannerContent = (banner: any) => {
    const bannerElement = (
      <div className="relative w-full">
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
            }}
          />
        </div>
        
        {(banner.title || banner.description) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 rounded-b-lg">
            {banner.title && (
              <h3 className="text-white text-sm sm:text-base font-medium mb-1 line-clamp-1">
                {banner.title}
              </h3>
            )}
            {banner.description && (
              <p className="text-white/90 text-xs sm:text-sm line-clamp-2">
                {banner.description}
              </p>
            )}
            {banner.cta_text && (
              <div className="mt-2">
                <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full">
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
          className="block cursor-pointer"
        >
          {bannerElement}
        </a>
      );
    } else {
      return (
        <Link to={banner.link_url} className="block cursor-pointer">
          {bannerElement}
        </Link>
      );
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={20}
        slidesPerView={1}
        navigation={{
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        }}
        pagination={{ 
          clickable: true,
          el: '.swiper-pagination'
        }}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={banners.length > 1}
        onInit={() => setSwiperInitialized(true)}
        className="rounded-lg"
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.id}>
            {renderBannerContent(banner)}
          </SwiperSlide>
        ))}
      </Swiper>
      
      {banners.length > 1 && (
        <>
          <div className="swiper-button-prev !hidden sm:!flex absolute left-2 top-1/2 transform -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-200">
            <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </div>
          <div className="swiper-button-next !hidden sm:!flex absolute right-2 top-1/2 transform -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-200">
            <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </div>
          <div className="swiper-pagination absolute bottom-4 left-0 right-0 z-10 flex justify-center"></div>
        </>
      )}
    </div>
  );
}