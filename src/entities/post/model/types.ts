export type PostStatus = 'draft' | 'published' | 'archived'

export type ProductLink = {
  id: string
  mall: string
  price: string
  label: string
  href: string
  badge: string
}

export type Post = {
  id: string
  title: string
  slug: string
  excerpt: string
  category: string
  tags: string[]
  content: string
  coverImage: string
  productLinks: ProductLink[]
  status: PostStatus
  createdAt: string
  updatedAt: string
}

export type PostStatusFilter = PostStatus | 'all'
