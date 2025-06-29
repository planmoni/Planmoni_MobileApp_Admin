import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, RefreshCw, Image as ImageIcon } from 'lucide-react';
import Button from '@/components/Button';
import Card from '@/components/Card';
import BannerFormModal from '@/components/BannerFormModal';
import { useBannersData, Banner } from '@/hooks/queries/useBannersData';
import { 
  useAddBanner, 
  useUpdateBanner, 
  useDeleteBanner, 
  useToggleBannerStatus 
} from '@/hooks/mutations/useBannerMutations';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function Banners() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);

  const { data: banners = [], isLoading, error } = useBannersData();
  const addBanner = useAddBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const toggleStatus = useToggleBannerStatus();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['banners']);
  };

  const handleAddBanner = () => {
    setEditingBanner(null);
    setIsModalOpen(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setEditingBanner(banner);
    setIsModalOpen(true);
  };

  const handlePreviewBanner = (banner: Banner) => {
    setPreviewBanner(banner);
  };

  const handleDeleteBanner = async (banner: Banner) => {
    if (window.confirm(`Are you sure you want to delete "${banner.title}"? This action cannot be undone.`)) {
      await deleteBanner.mutateAsync(banner);
    }
  };

  const handleToggleStatus = async (banner: Banner) => {
    await toggleStatus.mutateAsync({
      id: banner.id,
      is_active: !banner.is_active,
    });
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      if (editingBanner) {
        await updateBanner.mutateAsync({
          ...formData,
          id: editingBanner.id,
        });
      } else {
        await addBanner.mutateAsync(formData);
      }
      setIsModalOpen(false);
      setEditingBanner(null);
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  const isFormLoading = addBanner.isPending || updateBanner.isPending;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load banners</p>
        <Button onClick={handleRefresh}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Banner Management</h1>
          <p className="text-text-secondary">Manage full-design banners and advertisements for the mobile app</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-full bg-background-tertiary hover:bg-background-secondary transition-colors"
            disabled={refreshData.isPending}
          >
            <RefreshCw className={`h-5 w-5 text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
          <Button
            onClick={handleAddBanner}
            icon={<Plus size={20} />}
          >
            Add New Banner
          </Button>
        </div>
      </div>

      {/* Banner Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">Total Banners</p>
              <p className="text-2xl font-bold text-text">{banners.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">Active Banners</p>
              <p className="text-2xl font-bold text-text">
                {banners.filter(b => b.is_active).length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Eye className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">Inactive Banners</p>
              <p className="text-2xl font-bold text-text">
                {banners.filter(b => !b.is_active).length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
              <EyeOff className="h-5 w-5 text-gray-500" />
            </div>
          </div>
        </Card>
      </div>

      {/* Sample Banner Display */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-4">Banner Preview</h2>
        <Card className="p-4">
          <div className="flex flex-col items-center">
            <div className="w-full max-w-md overflow-hidden rounded-lg shadow-md mb-4">
              <img 
                src={previewBanner?.image_url || "/assets/images/Planmoni.png"} 
                alt="Banner Preview"
                className="w-full h-auto object-contain"
              />
            </div>
            <p className="text-sm text-text-secondary">
              {previewBanner 
                ? `Previewing: ${previewBanner.title}` 
                : "Select a banner to preview how it will appear in the app"}
            </p>
          </div>
        </Card>
      </div>

      {/* Banners List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
            <h3 className="text-lg font-semibold text-text mb-2">No banners found</h3>
            <p className="text-text-secondary mb-4">
              Create your first banner to start displaying advertisements in the app.
            </p>
            <Button onClick={handleAddBanner} icon={<Plus size={20} />}>
              Add New Banner
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background-tertiary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Banner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border">
                {banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-background-tertiary/20">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={banner.image_url}
                          alt={banner.title}
                          className="h-16 w-32 object-cover rounded-lg mr-4 cursor-pointer"
                          onClick={() => handlePreviewBanner(banner)}
                        />
                        <div>
                          <div className="text-sm font-medium text-text">
                            {banner.title}
                          </div>
                          {banner.cta_text && (
                            <div className="text-sm text-text-secondary">
                              CTA: {banner.cta_text}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text">
                        {banner.description || 'No description'}
                      </div>
                      {banner.link_url && (
                        <div className="text-sm text-text-secondary truncate max-w-xs">
                          {banner.link_url}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-text">{banner.order_index}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(banner)}
                        disabled={toggleStatus.isPending}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          banner.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {banner.is_active ? (
                          <>
                            <Eye size={12} className="mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} className="mr-1" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {new Date(banner.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handlePreviewBanner(banner)}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Preview banner"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEditBanner(banner)}
                          className="text-primary hover:text-primary-dark p-1"
                          title="Edit banner"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner)}
                          className="text-error hover:text-red-700 p-1"
                          title="Delete banner"
                          disabled={deleteBanner.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Banner Form Modal */}
      <BannerFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBanner(null);
        }}
        onSubmit={handleFormSubmit}
        banner={editingBanner}
        isLoading={isFormLoading}
      />
    </div>
  );
}