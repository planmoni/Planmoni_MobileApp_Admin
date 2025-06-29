import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Banner } from '@/hooks/queries/useBannersData';

type BannerFormData = {
  title: string;
  description?: string;
  cta_text?: string;
  link_url?: string;
  order_index: number;
  is_active: boolean;
  image_file?: File;
};

type UpdateBannerData = BannerFormData & {
  id: string;
};

// Upload image to Supabase Storage
const uploadImage = async (file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `banners/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('banners')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('banners')
    .getPublicUrl(filePath);

  return publicUrl;
};

// Delete image from Supabase Storage
const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract file path from URL
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const filePath = pathParts.slice(-2).join('/'); // Get 'banners/filename'

    const { error } = await supabase.storage
      .from('banners')
      .remove([filePath]);

    if (error) {
      console.warn('Failed to delete image from storage:', error.message);
    }
  } catch (error) {
    console.warn('Failed to parse image URL for deletion:', error);
  }
};

export const useAddBanner = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: BannerFormData): Promise<Banner> => {
      if (!data.image_file) {
        throw new Error('Image file is required');
      }

      // Upload image first
      const imageUrl = await uploadImage(data.image_file);

      // Create banner record
      const { data: banner, error } = await supabase
        .from('banners')
        .insert({
          title: data.title,
          description: data.description || null,
          image_url: imageUrl,
          cta_text: data.cta_text || null,
          link_url: data.link_url || null,
          order_index: data.order_index,
          is_active: data.is_active,
        })
        .select()
        .single();

      if (error) {
        // If banner creation fails, try to clean up the uploaded image
        await deleteImage(imageUrl);
        throw new Error(error.message);
      }

      return banner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast('Banner created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateBannerData): Promise<Banner> => {
      let imageUrl = '';

      // If new image file is provided, upload it
      if (data.image_file) {
        imageUrl = await uploadImage(data.image_file);
      }

      // Prepare update data
      const updateData: any = {
        title: data.title,
        description: data.description || null,
        cta_text: data.cta_text || null,
        link_url: data.link_url || null,
        order_index: data.order_index,
        is_active: data.is_active,
      };

      // Only update image_url if new image was uploaded
      if (imageUrl) {
        updateData.image_url = imageUrl;
      }

      const { data: banner, error } = await supabase
        .from('banners')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) {
        // If update fails and we uploaded a new image, try to clean it up
        if (imageUrl) {
          await deleteImage(imageUrl);
        }
        throw new Error(error.message);
      }

      return banner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast('Banner updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (banner: Banner): Promise<void> => {
      // Delete banner record
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', banner.id);

      if (error) {
        throw new Error(error.message);
      }

      // Try to delete associated image
      await deleteImage(banner.image_url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast('Banner deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });
};

export const useToggleBannerStatus = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }): Promise<Banner> => {
      const { data: banner, error } = await supabase
        .from('banners')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return banner;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['banners'] });
      showToast(`Banner ${is_active ? 'activated' : 'deactivated'} successfully`, 'success');
    },
    onError: (error: Error) => {
      showToast(error.message, 'error');
    },
  });
};