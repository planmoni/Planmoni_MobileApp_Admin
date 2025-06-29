import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import Card from './Card';
import Button from './Button';

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
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

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

  const renderBannerContent = (banner: Banner) => {
    const bannerElement = (
      <div className="relative group">
        <img
          src={banner.image_url}
          alt={banner.title}
          className="w-full h-auto rounded-lg shadow-sm transition-transform group-hover:scale-105"
          style={{ 
            width: '393px', 
            height: '116px',
            objectFit: 'cover'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzkzIiBoZWlnaHQ9IjExNiIgdmlld0JveD0iMCAwIDM5MyAxMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzOTMiIGhlaWdodD0iMTE2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTQ5NEE0IiBmb250LXNpemU9IjE0Ij5JbWFnZSBub3QgZm91bmQ8L3RleHQ+Cjwvc3ZnPg==';
          }}
        />
        
        {showAdminControls && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleToggleActive(banner);
              }}
              className="p-1 bg-white dark:bg-gray-800 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              title={banner.is_active ? 'Hide banner' : 'Show banner'}
            >
              {banner.is_active ? (
                <Eye className="h-4 w-4 text-green-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete(banner);
              }}
              className="p-1 bg-white dark:bg-gray-800 rounded shadow-sm hover:bg-red-50 dark:hover:bg-red-900"
              title="Delete banner"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
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

  return (
    <div className={`space-y-4 ${className}`}>
      {showAdminControls && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-text dark:text-text">
            Active Banners ({banners.length})
          </h3>
        </div>
      )}
      
      <div className="grid gap-4">
        {banners.map((banner) => (
          <div key={banner.id} className="flex justify-center">
            {renderBannerContent(banner)}
          </div>
        ))}
      </div>
    </div>
  );
}