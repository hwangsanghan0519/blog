export type PostStatus = 'draft' | 'published' | 'archived'

export type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  tags: string[]
  content: string
  coverImage: string
  status: PostStatus
  createdAt: string
  updatedAt: string
}

export type PostStatusFilter = PostStatus | 'all'
