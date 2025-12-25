export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface BlogAuthor {
  id: string;
  name: string;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  created_by: string | null;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  author_id: string | null;
  category: string;
  featured: boolean;
  tags: string[];
  image_path: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BlogPostWithImageUrl extends BlogPost {
  image_url: string | null;
  read_time?: string;
}

export interface BlogPostWithDetails extends BlogPostWithImageUrl {
  author?: BlogAuthor | null;
  category_details?: BlogCategory | null;
}

export type BlogPostInsert = Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export type BlogPostUpdate = Partial<Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>>;

export type BlogCategoryInsert = Omit<BlogCategory, 'id' | 'created_at' | 'created_by'>;

export type BlogAuthorInsert = Omit<BlogAuthor, 'id' | 'created_at' | 'created_by'>;
