import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Star, X, Image as ImageIcon } from 'lucide-react';
import Button from '../../components/Button';
import Card from '../../components/Card';
import AddCategoryModal from '../../components/AddCategoryModal';
import AddAuthorModal from '../../components/AddAuthorModal';
import RichTextEditor from '../../components/RichTextEditor';
import { useToast } from '../../contexts/ToastContext';
import {
  getAllBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  uploadBlogImage,
  deleteBlogImage,
  generateSlug,
  getAllCategories,
  getAllAuthors,
  createCategory,
  createAuthor,
} from '../../lib/blog-utils';
import type { BlogPostWithImageUrl, BlogPostInsert, BlogCategory, BlogAuthor } from '../../types/blog';

interface BlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_id: string;
  category: string;
  featured: boolean;
  tags: string;
  published: boolean;
  image_file: File | null;
}

export default function Blog() {
  const { showToast } = useToast();
  const [posts, setPosts] = useState<BlogPostWithImageUrl[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<BlogPostWithImageUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPostWithImageUrl | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddAuthor, setShowAddAuthor] = useState(false);

  const [formData, setFormData] = useState<BlogFormData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author_id: '',
    category: '',
    featured: false,
    tags: '',
    published: false,
    image_file: null,
  });

  useEffect(() => {
    fetchPosts();
    fetchCategoriesAndTags();
  }, []);

  useEffect(() => {
    filterPosts();
  }, [posts, searchQuery, filterStatus, filterCategory]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await getAllBlogPosts();
      setPosts(data);
    } catch (error) {
      showToast('Failed to fetch blog posts', 'error');
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndTags = async () => {
    try {
      const [fetchedCategories, fetchedAuthors] = await Promise.all([
        getAllCategories(),
        getAllAuthors(),
      ]);
      setCategories(fetchedCategories);
      setAuthors(fetchedAuthors);
    } catch (error) {
      console.error('Error fetching categories and authors:', error);
    }
  };

  const handleAddCategory = async (name: string, description: string) => {
    const slug = generateSlug(name);
    await createCategory({ name, slug, description: description || null });
    await fetchCategoriesAndTags();
    showToast('Category added successfully', 'success');
  };

  const handleAddAuthor = async (name: string, email: string, bio: string) => {
    await createAuthor({
      name,
      email: email || null,
      bio: bio || null,
      avatar_url: null,
    });
    await fetchCategoriesAndTags();
    showToast('Author added successfully', 'success');
  };

  const filterPosts = () => {
    let filtered = [...posts];

    if (searchQuery) {
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          post.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((post) =>
        filterStatus === 'published' ? post.published : !post.published
      );
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter((post) => post.category === filterCategory);
    }

    setFilteredPosts(filtered);
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image size must be less than 5MB', 'error');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        showToast('Invalid image type. Allowed: JPEG, PNG, WebP, GIF', 'error');
        return;
      }

      setFormData({ ...formData, image_file: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image_file: null });
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.excerpt || !formData.category) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      setLoading(true);

      let imagePath = editingPost?.image_path || null;

      if (formData.image_file) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const sanitizedFileName = formData.image_file.name
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');

        const fileName = `${Date.now()}-${sanitizedFileName}`;
        const path = `${year}/${month}/${fileName}`;

        imagePath = await uploadBlogImage(formData.image_file, path);

        if (editingPost?.image_path) {
          try {
            await deleteBlogImage(editingPost.image_path);
          } catch (error) {
            console.error('Error deleting old image:', error);
          }
        }
      }

      const tagsArray = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const postData: BlogPostInsert = {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt,
        content: formData.content || null,
        author_id: formData.author_id || null,
        category: formData.category,
        featured: formData.featured,
        tags: tagsArray,
        image_path: imagePath,
        published: formData.published,
        published_at: formData.published ? new Date().toISOString() : null,
      };

      if (editingPost) {
        await updateBlogPost(editingPost.id, postData);
        showToast('Blog post updated successfully', 'success');
      } else {
        await createBlogPost(postData);
        showToast('Blog post created successfully', 'success');
      }

      resetForm();
      setShowModal(false);
      fetchPosts();
      fetchCategoriesAndTags();
    } catch (error) {
      showToast(editingPost ? 'Failed to update post' : 'Failed to create post', 'error');
      console.error('Error saving post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (post: BlogPostWithImageUrl) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content || '',
      author_id: post.author_id || '',
      category: post.category,
      featured: post.featured,
      tags: post.tags.join(', '),
      published: post.published,
      image_file: null,
    });
    setImagePreview(post.image_url);
    setShowModal(true);
  };

  const handleDelete = async (post: BlogPostWithImageUrl) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"?`)) {
      return;
    }

    try {
      setLoading(true);

      if (post.image_path) {
        try {
          await deleteBlogImage(post.image_path);
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      }

      await deleteBlogPost(post.id);
      showToast('Blog post deleted successfully', 'success');
      fetchPosts();
    } catch (error) {
      showToast('Failed to delete post', 'error');
      console.error('Error deleting post:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (post: BlogPostWithImageUrl) => {
    try {
      await updateBlogPost(post.id, {
        published: !post.published,
        published_at: !post.published ? new Date().toISOString() : post.published_at,
      });
      showToast(
        !post.published ? 'Post published successfully' : 'Post unpublished successfully',
        'success'
      );
      fetchPosts();
    } catch (error) {
      showToast('Failed to update post status', 'error');
      console.error('Error toggling publish status:', error);
    }
  };

  const toggleFeatured = async (post: BlogPostWithImageUrl) => {
    try {
      await updateBlogPost(post.id, {
        featured: !post.featured,
      });
      showToast(
        !post.featured ? 'Post marked as featured' : 'Post unmarked as featured',
        'success'
      );
      fetchPosts();
    } catch (error) {
      showToast('Failed to update featured status', 'error');
      console.error('Error toggling featured status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      author_id: '',
      category: '',
      featured: false,
      tags: '',
      published: false,
      image_file: null,
    });
    setEditingPost(null);
    setImagePreview(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Management</h1>
          <p className="text-gray-600 mt-1">Create and manage blog posts</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={loading}
        >
          <Plus className="h-5 w-5 mr-2" />
          New Post
        </Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'published' | 'draft')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading posts...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery || filterStatus !== 'all' || filterCategory !== 'all'
                ? 'No posts found matching your filters'
                : 'No blog posts yet. Create your first post!'}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex flex-col md:flex-row gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  {post.image_url && (
                    <div className="w-full md:w-48 h-32 flex-shrink-0">
                      <img
                        src={post.image_url}
                        alt={post.title}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {post.title}
                          </h3>
                          {post.featured && (
                            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{post.excerpt}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">{post.category}</span>
                          {post.author_id && (
                            <span>{authors.find(a => a.id === post.author_id)?.name || 'Unknown Author'}</span>
                          )}
                          <span>{post.read_time}</span>
                          <span
                            className={`px-2 py-1 rounded ${
                              post.published
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {post.published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleFeatured(post)}
                          className="p-2 text-gray-600 hover:text-yellow-600 rounded-lg hover:bg-gray-100"
                          title={post.featured ? 'Unmark as featured' : 'Mark as featured'}
                        >
                          <Star
                            className={`h-5 w-5 ${
                              post.featured ? 'fill-yellow-500 text-yellow-500' : ''
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => togglePublish(post)}
                          className="p-2 text-gray-600 hover:text-primary rounded-lg hover:bg-gray-100"
                          title={post.published ? 'Unpublish' : 'Publish'}
                        >
                          {post.published ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(post)}
                          className="p-2 text-gray-600 hover:text-primary rounded-lg hover:bg-gray-100"
                          title="Edit"
                        >
                          <Edit2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(post)}
                          className="p-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100"
                          title="Delete"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPost ? 'Edit Blog Post' : 'Create New Blog Post'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Featured Image
                </label>
                <div className="space-y-2">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">
                          Click to upload image (Max 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Excerpt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(value) => setFormData({ ...formData, content: value })}
                  placeholder="Write your blog content here..."
                  className="min-h-[300px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    >
                      <option value="">Select category...</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(true)}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                      title="Add new category"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.author_id}
                      onChange={(e) => setFormData({ ...formData, author_id: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select author...</option>
                      {authors.map((author) => (
                        <option key={author.id} value={author.id}>
                          {author.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddAuthor(true)}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                      title="Add new author"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="budgeting, savings, tips"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Featured Post</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Publish Immediately</span>
                </label>
              </div>
            </form>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="secondary" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Saving...' : editingPost ? 'Update Post' : 'Create Post'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onAdd={handleAddCategory}
        />
      )}

      {showAddAuthor && (
        <AddAuthorModal
          onClose={() => setShowAddAuthor(false)}
          onAdd={handleAddAuthor}
        />
      )}
    </div>
  );
}
