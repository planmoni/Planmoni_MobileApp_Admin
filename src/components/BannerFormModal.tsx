import { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import Button from '@/components/Button';
import { Banner } from '@/hooks/queries/useBannersData';

type BannerFormData = {
  title: string;
  description: string;
  cta_text: string;
  link_url: string;
  order_index: number;
  is_active: boolean;
  image_file?: File;
};

type BannerFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BannerFormData) => void;
  banner?: Banner | null;
  isLoading?: boolean;
};

export default function BannerFormModal({
  isOpen,
  onClose,
  onSubmit,
  banner,
  isLoading = false,
}: BannerFormModalProps) {
  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    description: '',
    cta_text: '',
    link_url: '',
    order_index: 0,
    is_active: true,
  });
  const [imagePreview, setImagePreview] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title,
        description: banner.description || '',
        cta_text: banner.cta_text || '',
        link_url: banner.link_url || '',
        order_index: banner.order_index,
        is_active: banner.is_active,
      });
      setImagePreview(banner.image_url);
    } else {
      setFormData({
        title: '',
        description: '',
        cta_text: '',
        link_url: '',
        order_index: 0,
        is_active: true,
      });
      setImagePreview('');
    }
  }, [banner]);

  const handleInputChange = (field: keyof BannerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setFormData(prev => ({ ...prev, image_file: file }));
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      return;
    }
    
    if (!banner && !formData.image_file) {
      return;
    }

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text">
            {banner ? 'Edit Banner' : 'Add New Banner'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background-tertiary rounded-full transition-colors"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Banner Image *
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <div className="space-y-4">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg object-cover"
                  />
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleImageChange(e.target.files[0])}
                      className="hidden"
                      id="image-upload"
                      disabled={isLoading}
                    />
                    <label
                      htmlFor="image-upload"
                      className="inline-flex items-center px-4 py-2 bg-background-tertiary text-text rounded-md hover:bg-background-secondary cursor-pointer transition-colors"
                    >
                      <Upload size={16} className="mr-2" />
                      Change Image
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ImageIcon size={48} className="mx-auto text-text-tertiary" />
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleImageChange(e.target.files[0])}
                      className="hidden"
                      id="image-upload"
                      disabled={isLoading}
                    />
                    <label
                      htmlFor="image-upload"
                      className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark cursor-pointer transition-colors"
                    >
                      <Upload size={16} className="mr-2" />
                      Upload Image
                    </label>
                  </div>
                  <p className="text-sm text-text-secondary">
                    Drag and drop an image here, or click to select
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter banner title"
              required
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter banner description"
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* CTA Text */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Call to Action Text
            </label>
            <input
              type="text"
              value={formData.cta_text}
              onChange={(e) => handleInputChange('cta_text', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Learn More, Shop Now"
              disabled={isLoading}
            />
          </div>

          {/* Link URL */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Link URL
            </label>
            <input
              type="url"
              value={formData.link_url}
              onChange={(e) => handleInputChange('link_url', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com"
              disabled={isLoading}
            />
          </div>

          {/* Order Index */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={formData.order_index}
              onChange={(e) => handleInputChange('order_index', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0"
              min="0"
              disabled={isLoading}
            />
            <p className="text-xs text-text-secondary mt-1">
              Lower numbers appear first in the carousel
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
              disabled={isLoading}
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-text">
              Active (visible in app)
            </label>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {banner ? 'Update Banner' : 'Create Banner'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}