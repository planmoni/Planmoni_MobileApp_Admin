import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useBanners } from '@/hooks/queries/useBanners';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';

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
  showControls = false
}: BannerCarouselProps) {
  const { data: banners, isLoading, error } = useBanners(true);
  const [swiperInitialized, setSwiperInitialized] = useState(false);

  useEffect(() => {
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error || !banners || banners.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-gray-200 ${className}`}>
        <p className="text-gray-400 text-sm">No banners available</p>
      </div>
    );
  }

  const renderBannerContent = (banner: any) => {
    const bannerElement = (
      <div className="relative xl:w-full w-[400px] h-full group">
        <div className="w-full overflow-hidden rounded-xl sm:rounded-2xl flex items-center justify-center bg-gray-100">
          <img
            src={banner.image_url}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
            }}
          />
        </div>

        {(banner.title || banner.description) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent p-3 sm:p-4 md:p-6 rounded-b-xl sm:rounded-b-2xl">
            {banner.title && (
              <h3 className="text-white text-xs sm:text-sm md:text-base lg:text-lg font-bold mb-0.5 sm:mb-1 md:mb-1.5 line-clamp-1 drop-shadow-lg">
                {banner.title}
              </h3>
            )}
            {banner.description && (
              <p className="text-white/90 text-[10px] sm:text-xs md:text-sm lg:text-base line-clamp-1 sm:line-clamp-2 drop-shadow-md">
                {banner.description}
              </p>
            )}
            {banner.cta_text && (
              <div className="mt-1.5 sm:mt-2 md:mt-3">
                <span className="inline-flex items-center bg-white/95 text-gray-900 text-[10px] sm:text-xs md:text-sm px-2.5 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 rounded-md sm:rounded-lg md:rounded-xl font-semibold shadow-lg hover:bg-white transition-colors">
                  {banner.cta_text}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );

    if (!banner.link_url) {
      return bannerElement;
    }

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
        spaceBetween={20}
        slidesPerView={1}
        navigation={showControls ? {
          nextEl: '.banner-carousel .swiper-button-next',
          prevEl: '.banner-carousel .swiper-button-prev',
        } : false}
        pagination={showControls ? {
          clickable: true,
          el: '.banner-carousel .swiper-pagination',
          bulletClass: 'swiper-pagination-bullet',
          bulletActiveClass: 'swiper-pagination-bullet-active',
        } : false}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={banners.length > 1}
        onInit={() => setSwiperInitialized(true)}
        className="rounded-2xl overflow-hidden"
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
          <div className="swiper-button-prev !hidden md:!flex absolute left-4 top-1/2 transform -translate-y-1/2 z-20 items-center justify-center w-11 h-11 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg cursor-pointer hover:bg-white hover:scale-105 transition-all duration-200 group border border-gray-200">
            <ArrowLeft className="h-5 w-5 text-gray-700 group-hover:text-gray-900 transition-colors" strokeWidth={2.5} />
          </div>

          <div className="swiper-button-next !hidden md:!flex absolute right-4 top-1/2 transform -translate-y-1/2 z-20 items-center justify-center w-11 h-11 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg cursor-pointer hover:bg-white hover:scale-105 transition-all duration-200 group border border-gray-200">
            <ArrowRight className="h-5 w-5 text-gray-700 group-hover:text-gray-900 transition-colors" strokeWidth={2.5} />
          </div>

          <div className="swiper-pagination !relative !bottom-0 !top-5 flex justify-center gap-2 md:!absolute md:!bottom-5 md:!top-auto"></div>
        </>
      )}

      <style>{`
        .banner-carousel .swiper-pagination-bullet {
          width: 10px !important;
          height: 10px !important;
          margin: 0 5px !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.5) !important;
          backdrop-filter: blur(4px) !important;
          opacity: 1 !important;
          transition: all 0.3s ease !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
        }

        .banner-carousel .swiper-pagination-bullet-active {
          width: 28px !important;
          border-radius: 5px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.5) !important;
        }

        @media (max-width: 768px) {
          .banner-carousel .swiper-pagination {
            position: relative !important;
            bottom: auto !important;
            top: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}
