import { supabase } from './supabase';
import type { BlogPost, BlogPostWithImageUrl, BlogPostInsert, BlogPostUpdate } from '../types/blog';

const STORAGE_BUCKET = 'blog-images';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function getBlogImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${imagePath}`;
}

export function addImageUrlToPost(post: BlogPost): BlogPostWithImageUrl {
  return {
    ...post,
    image_url: getBlogImageUrl(post.image_path),
  };
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatBlogDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function getPublishedBlogPosts(): Promise<BlogPostWithImageUrl[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(addImageUrlToPost);
}

export async function getAllBlogPosts(): Promise<BlogPostWithImageUrl[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(addImageUrlToPost);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostWithImageUrl | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data ? addImageUrlToPost(data) : null;
}

export async function getBlogPostById(id: string): Promise<BlogPostWithImageUrl | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? addImageUrlToPost(data) : null;
}

export async function getFeaturedBlogPosts(): Promise<BlogPostWithImageUrl[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .eq('featured', true)
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(addImageUrlToPost);
}

export async function getBlogPostsByCategory(category: string): Promise<BlogPostWithImageUrl[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .eq('category', category)
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(addImageUrlToPost);
}

export async function searchBlogPosts(query: string): Promise<BlogPostWithImageUrl[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%,content.ilike.%${query}%`)
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(addImageUrlToPost);
}

export async function createBlogPost(post: BlogPostInsert): Promise<BlogPostWithImageUrl> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      ...post,
      created_by: user?.id || null,
    })
    .select()
    .single();

  if (error) throw error;
  return addImageUrlToPost(data);
}

export async function updateBlogPost(id: string, updates: BlogPostUpdate): Promise<BlogPostWithImageUrl> {
  const { data, error } = await supabase
    .from('blog_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return addImageUrlToPost(data);
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function uploadBlogImage(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return data.path;
}

export async function deleteBlogImage(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) throw error;
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('category')
    .eq('published', true);

  if (error) throw error;

  const categories = [...new Set(data?.map(post => post.category) || [])];
  return categories.sort();
}

export async function getAllTags(): Promise<string[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('tags')
    .eq('published', true);

  if (error) throw error;

  const allTags = data?.flatMap(post => post.tags || []) || [];
  const uniqueTags = [...new Set(allTags)];
  return uniqueTags.sort();
}
