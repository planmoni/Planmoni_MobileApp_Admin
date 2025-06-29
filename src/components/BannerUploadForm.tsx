import { useState } from 'react';
import { Upload, X, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import Button from './Button';
import Card from './Card';

export default function BannerUploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number | null>(null);
  const [imageHeight, setImageHeight] = useState<number | null>(null);
  const { showToast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL and get image dimensions
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Get image dimensions
      const img = new Image();
      img.onload = () => {
        setImageWidth(img.width);
        setImageHeight(img.height);
      };
      img.src = url;
      
      // Set default title from filename if empty
      if (!title) {
        const fileName = file.name.split('.')[0];
        // Convert to title case and replace hyphens/underscores with spaces
        const formattedTitle = fileName
          .replace(/[-_]/g, ' ')
          .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        setTitle(formattedTitle);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setImageWidth(null);
    setImageHeight(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selectedFile) {
      showToast('Please select an image file', 'error');
      return;
    }

    if (!title.trim()) {
      showToast('Please enter a banner title', 'error');
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${fileExt}`;

      // Upload image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(uploadData.path);

      // Insert banner record into database
      const { error: insertError } = await supabase
        .from('banners')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          image_url: publicUrl,
          link_url: linkUrl.trim() || null,
          is_active: true,
          order_index: 0
        });

      if (insertError) {
        throw insertError;
      }

      showToast('Banner uploaded successfully!', 'success');
      
      // Reset form
      setSelectedFile(null);
      setLinkUrl('');
      setTitle('');
      setDescription('');
      handleRemoveFile();
      
      // Reset file input
      const fileInput = document.getElementById('banner-file') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

    } catch (error) {
      console.error('Error uploading banner:', error);
      showToast('Failed to upload banner. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const isExternalUrl = linkUrl.startsWith('http://') || linkUrl.startsWith('https://');

  return (
    <Card title="Upload Banner" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Section */}
        <div>
          <label className="block text-sm font-medium text-text dark:text-text mb-2">
            Banner Image
          </label>
          <p className="text-xs text-text-secondary dark:text-text-secondary mb-3">
            Upload any size image - the carousel will adapt to display it properly
          </p>
          
          {!selectedFile ? (
            <div className="border-2 border-dashed border-border dark:border-border rounded-lg p-8 text-center hover:border-primary dark:hover:border-primary-light transition-colors">
              <input
                id="banner-file"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="banner-file"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-12 w-12 text-text-tertiary dark:text-text-tertiary mb-4" />
                <span className="text-text dark:text-text font-medium mb-2">
                  Click to upload banner image
                </span>
                <span className="text-text-secondary dark:text-text-secondary text-sm">
                  PNG, JPG, GIF up to 5MB
                </span>
              </label>
            </div>
          ) : (
            <div className="relative">
              <div className="border border-border dark:border-border rounded-lg p-4 bg-background-tertiary dark:bg-background-tertiary">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-text dark:text-text">
                    {selectedFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1 hover:bg-background-secondary dark:hover:bg-background-secondary rounded"
                  >
                    <X className="h-4 w-4 text-text-secondary dark:text-text-secondary" />
                  </button>
                </div>
                
                {previewUrl && (
                  <div className="mt-3">
                    <img
                      src={previewUrl}
                      alt="Banner preview"
                      className="max-w-full h-auto rounded border border-border dark:border-border"
                      style={{ maxHeight: '200px' }}
                    />
                    {imageWidth && imageHeight && (
                      <p className="mt-2 text-xs text-text-secondary dark:text-text-secondary">
                        Image dimensions: {imageWidth} × {imageHeight} pixels
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Title Input */}
        <div>
          <label htmlFor="banner-title" className="block text-sm font-medium text-text dark:text-text mb-2">
            Banner Title
          </label>
          <input
            id="banner-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter banner title"
            className="block w-full px-3 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light"
            required
          />
        </div>

        {/* Description Input */}
        <div>
          <label htmlFor="banner-description" className="block text-sm font-medium text-text dark:text-text mb-2">
            Description (Optional)
          </label>
          <textarea
            id="banner-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter banner description"
            className="block w-full px-3 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light"
            rows={2}
          />
        </div>

        {/* URL Input Section */}
        <div>
          <label htmlFor="link-url" className="block text-sm font-medium text-text dark:text-text mb-2">
            Link URL (Optional)
          </label>
          <p className="text-xs text-text-secondary dark:text-text-secondary mb-3">
            Enter a full URL (e.g., https://planmoni.com/learn-more) or internal path (e.g., /learn-more)
          </p>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isExternalUrl ? (
                <ExternalLink className="h-5 w-5 text-text-secondary dark:text-text-secondary" />
              ) : (
                <LinkIcon className="h-5 w-5 text-text-secondary dark:text-text-secondary" />
              )}
            </div>
            <input
              id="link-url"
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://planmoni.com/learn-more or /learn-more"
              className="block w-full pl-10 pr-3 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light"
            />
          </div>
          {linkUrl && (
            <p className="mt-2 text-xs text-text-secondary dark:text-text-secondary">
              {isExternalUrl ? 'External link - will open in new tab' : 'Internal link - will navigate within app'}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!selectedFile || !title.trim() || isUploading}
            isLoading={isUploading}
            className="min-w-[120px]"
          >
            {isUploading ? 'Uploading...' : 'Upload Banner'}
          </Button>
        </div>
      </form>
    </Card>
  );
}