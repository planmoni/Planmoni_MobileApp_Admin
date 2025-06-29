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
      <img
        src={banner.image_url}
        alt={banner.title}
        className="w-full h-auto rounded-lg shadow-sm"
        style={{ 
          width: '100%',
          height: '116px',
          objectFit: 'cover'
        }}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
        }}
      />
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
          className="block"
        >
          {bannerElement}
        </a>
      );
    } else {
      return (
        <Link to={banner.link_url} className="block">
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
          <div className="swiper-button-prev absolute left-2 top-1/2 transform -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/70 dark:bg-gray-800/70 shadow-md cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </div>
          <div className="swiper-button-next absolute right-2 top-1/2 transform -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white/70 dark:bg-gray-800/70 shadow-md cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-colors">
            <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </div>
          <div className="swiper-pagination absolute bottom-2 left-0 right-0 z-10 flex justify-center"></div>
        </>
      )}
    </div>
  );
}