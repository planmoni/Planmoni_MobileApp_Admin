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
      <div className={`flex justify-center items-center h-32 sm:h-40 md:h-48 lg:h-56 ${className}`}>
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
        <img
          src={banner.image_url}
          alt={banner.title}
          className="w-full h-auto rounded-lg shadow-sm object-cover"
          style={{ 
            width: '100%',
            height: 'auto',
            minHeight: '120px',
            maxHeight: '400px',
            objectFit: 'cover'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
          }}
        />
        {banner.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 sm:p-3 md:p-4 rounded-b-lg">
            <h3 className="text-white text-xs sm:text-sm md:text-base font-medium line-clamp-1">
              {banner.title}
            </h3>
            {banner.description && (
              <p className="text-white text-xs opacity-90 mt-1 line-clamp-2 hidden sm:block">
                {banner.description}
              </p>
            )}
            {banner.cta_text && (
              <div className="mt-2 hidden md:block">
                <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
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
          className="block hover:opacity-90 transition-opacity"
        >
          {bannerElement}
        </a>
      );
    } else {
      return (
        <Link to={banner.link_url} className="block hover:opacity-90 transition-opacity">
          {bannerElement}
        </Link>
      );
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={10}
        slidesPerView={1}
        breakpoints={{
          640: {
            slidesPerView: 1,
            spaceBetween: 15,
          },
          768: {
            slidesPerView: 1,
            spaceBetween: 20,
          },
          1024: {
            slidesPerView: 1,
            spaceBetween: 20,
          },
        }}
        navigation={{
          nextEl: '.swiper-button-next',
          prevEl: '.swiper-button-prev',
        }}
        pagination={{ 
          clickable: true,
          el: '.swiper-pagination',
          bulletClass: 'swiper-pagination-bullet',
          bulletActiveClass: 'swiper-pagination-bullet-active',
        }}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={banners.length > 1}
        onInit={() => setSwiperInitialized(true)}
        className="rounded-lg overflow-hidden"
        style={{
          '--swiper-pagination-color': '#1E3A8A',
          '--swiper-pagination-bullet-inactive-color': '#CBD5E1',
          '--swiper-pagination-bullet-size': '8px',
          '--swiper-pagination-bullet-horizontal-gap': '4px',
        } as React.CSSProperties}
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.id}>
            {renderBannerContent(banner)}
          </SwiperSlide>
        ))}
      </Swiper>
      
      {banners.length > 1 && (
        <>
          {/* Navigation Arrows - Hidden on mobile, visible on larger screens */}
          <div className="swiper-button-prev !hidden md:!flex absolute left-2 top-1/2 transform -translate-y-1/2 z-10 items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110">
            <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5 text-gray-700 dark:text-gray-200" />
          </div>
          <div className="swiper-button-next !hidden md:!flex absolute right-2 top-1/2 transform -translate-y-1/2 z-10 items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-white/80 dark:bg-gray-800/80 shadow-lg cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110">
            <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5 text-gray-700 dark:text-gray-200" />
          </div>
          
          {/* Pagination Dots - Responsive positioning */}
          <div className="swiper-pagination absolute bottom-2 sm:bottom-3 md:bottom-4 left-0 right-0 z-10 flex justify-center"></div>
        </>
      )}
      
      {/* Custom styles for responsive pagination */}
      <style jsx>{`
        .swiper-pagination-bullet {
          width: 6px !important;
          height: 6px !important;
          margin: 0 2px !important;
        }
        
        @media (min-width: 640px) {
          .swiper-pagination-bullet {
            width: 8px !important;
            height: 8px !important;
            margin: 0 3px !important;
          }
        }
        
        @media (min-width: 768px) {
          .swiper-pagination-bullet {
            width: 10px !important;
            height: 10px !important;
            margin: 0 4px !important;
          }
        }
      `}</style>
    </div>
  );
}