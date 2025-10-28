import { ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import BannerCarousel from './BannerCarousel';

interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  cta_text: string | null;
  link_url: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BannerDisplayProps {
  showAdminControls?: boolean;
  className?: string;
}

export default function BannerDisplay({ showAdminControls = false, className = '' }: BannerDisplayProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: banners, isLoading, error } = useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const query = supabase
        .from('banners')
        .select('*')
        .order('order_index', { ascending: true });

      if (!showAdminControls) {
        query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Banner[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('banners')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast('Banner status updated', 'success');
    },
    onError: (error) => {
      console.error('Error updating banner:', error);
      showToast('Failed to update banner status', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast('Banner deleted successfully', 'success');
    },
    onError: (error) => {
      console.error('Error deleting banner:', error);
      showToast('Failed to delete banner', 'error');
    },
  });

  const handleToggleActive = (banner: Banner) => {
    toggleActiveMutation.mutate({
      id: banner.id,
      is_active: !banner.is_active,
    });
  };

  const handleDelete = (banner: Banner) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      deleteMutation.mutate(banner.id);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex justify-center items-center h-32 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    console.error('Error loading banners:', error);
    return null;
  }

  if (!banners || banners.length === 0) {
    if (showAdminControls) {
      return (
        <div className={`bg-white rounded-2xl shadow-soft border border-gray-100 ${className}`}>
          <div className="text-center py-12">
            <p className="text-gray-500">
              No banners uploaded yet. Upload your first banner above.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  if (!showAdminControls) {
    return <BannerCarousel className={className} />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">All Banners</h3>
          <p className="text-sm text-gray-500 mt-1">{banners.length} banner{banners.length !== 1 ? 's' : ''} in total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {banners.map((banner) => (
          <div key={banner.id} className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden group hover:shadow-md transition-all duration-200">
            <div className="relative">
              <div className="aspect-video xl:w-full w-[350px] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
                  }}
                />
              </div>

              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => handleToggleActive(banner)}
                  className="p-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md hover:bg-white transition-all duration-200 hover:scale-110"
                  title={banner.is_active ? 'Hide banner' : 'Show banner'}
                >
                  {banner.is_active ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(banner)}
                  className="p-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-md hover:bg-red-50 transition-all duration-200 hover:scale-110"
                  title="Delete banner"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <h4 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                {banner.title}
              </h4>

              {banner.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {banner.description}
                </p>
              )}

              {banner.link_url && (
                <div className="flex items-center text-xs text-gray-400 mb-3 min-w-0">
                  <span className="mr-1 flex-shrink-0">Link:</span>
                  <div className="min-w-0 flex-1">
                    {banner.link_url.startsWith('http') ? (
                      <a
                        href={banner.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary hover:text-primary-light hover:underline transition-colors"
                      >
                        <span className="truncate">{banner.link_url}</span>
                        <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-primary truncate block">
                        {banner.link_url}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className={`px-3 py-1 text-xs font-medium rounded-lg ${
                  banner.is_active
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-50 text-gray-600'
                }`}>
                  {banner.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  Order: {banner.order_index}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
