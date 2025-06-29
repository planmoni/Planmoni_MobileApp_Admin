import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import Card from './Card';
import Button from './Button';
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
  const { session } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Fetch banners
  const { data: banners, isLoading, error } = useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const query = supabase
        .from('banners')
        .select('*')
        .order('order_index', { ascending: true });
      
      // Only filter by active status if not in admin mode
      if (!showAdminControls) {
        query.eq('is_active', true);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      return data as Banner[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Toggle banner active status
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

  // Delete banner
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    console.error('Error loading banners:', error);
    return null; // Fail silently for public display
  }

  if (!banners || banners.length === 0) {
    if (showAdminControls) {
      return (
        <Card className={className}>
          <div className="text-center py-8">
            <p className="text-text-secondary dark:text-text-secondary">
              No banners uploaded yet. Upload your first banner above.
            </p>
          </div>
        </Card>
      );
    }
    return null; // Don't show anything if no banners for public display
  }

  // If not in admin mode, just show the carousel
  if (!showAdminControls) {
    return <BannerCarousel className={className} />;
  }

  // Admin view with controls
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-text dark:text-text">
          Banners ({banners.length})
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {banners.map((banner) => (
          <Card key={banner.id} className="overflow-hidden">
            <div className="relative group">
              <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
                  }}
                />
              </div>
              
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleToggleActive(banner)}
                  className="p-1.5 bg-white dark:bg-gray-800 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
                  className="p-1.5 bg-white dark:bg-gray-800 rounded shadow-sm hover:bg-red-50 dark:hover:bg-red-900 transition-colors"
                  title="Delete banner"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <h4 className="font-medium text-text dark:text-text mb-2 line-clamp-1">
                {banner.title}
              </h4>
              
              {banner.description && (
                <p className="text-sm text-text-secondary dark:text-text-secondary mb-3 line-clamp-2">
                  {banner.description}
                </p>
              )}
              
              {banner.link_url && (
                <div className="flex items-center text-xs text-text-tertiary dark:text-text-tertiary mb-3">
                  <span className="mr-1 flex-shrink-0">Link:</span>
                  <div className="min-w-0 flex-1">
                    {banner.link_url.startsWith('http') ? (
                      <a 
                        href={banner.link_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-primary dark:text-primary-light hover:underline"
                      >
                        <span className="truncate">{banner.link_url}</span>
                        <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-primary dark:text-primary-light truncate block">
                        {banner.link_url}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  banner.is_active 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                }`}>
                  {banner.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-text-tertiary dark:text-text-tertiary">
                  Order: {banner.order_index}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}