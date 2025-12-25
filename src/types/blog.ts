export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string | null;
  author: string;
  category: string;
  read_time: string;
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
}

export type BlogPostInsert = Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'created_by'>;

export type BlogPostUpdate = Partial<Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>>;
