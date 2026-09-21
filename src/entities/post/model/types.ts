export type ProductSourceType = 'youtube' | 'instagram' | 'daily' | 'brand' | 'broadcast' | 'drama' | 'variety'

export type ProductSource = {
  type: ProductSourceType
  url: string
}

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
  source?: ProductSource | null
  coverImage: string
  detailImages: string[]
  detailDescriptions: string[]
  purchaseTitle: string
  productLinks: ProductLink[]
  status: PostStatus
  createdAt: string
  updatedAt: string
}

export type PostStatusFilter = PostStatus | 'all'
