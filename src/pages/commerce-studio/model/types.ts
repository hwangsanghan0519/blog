import type { Post } from '../../../entities/post/model/types'

/** 관리자 작업 공간에서 전환할 수 있는 화면입니다. */
export type ViewMode = 'editor' | 'preview' | 'analytics'

export type AdBannerSettings = {
  id: string
  enabled: boolean
  eyebrow: string
  title: string
  description: string
  ctaLabel: string
  embedCode: string
  href: string
  image: string
  backgroundColor: string
  placement: 'both' | 'header' | 'footer'
}

export type HeroVideoSettings = {
  enabled: boolean
  visibilityConfigured: boolean
  youtubeUrl: string
  eyebrow: string
  title: string
  stickerImage: string
  stickerHref: string
}

export type CommerceSettings = {
  darkMode: boolean
  adBanners: AdBannerSettings[]
  heroVideo: HeroVideoSettings
}

/** 브라우저와 서버가 공유하는 직렬화 가능한 커머스 콘텐츠 계약입니다. */
export type CloudCommerceData = {
  adBanners?: AdBannerSettings[]
  categories?: string[]
  categoryImages?: Record<string, string>
  heroVideo?: Partial<HeroVideoSettings>
  posts?: Post[]
  savedAt?: string
}

export type CloudCommerceSnapshot = {
  adBanners: AdBannerSettings[]
  categories: string[]
  categoryImages: Record<string, string>
  heroVideo: HeroVideoSettings
  posts: Post[]
}

export type CloudCommercePatch = Partial<Omit<CloudCommerceSnapshot, 'posts'>> & {
  deletedPostIds?: string[]
  postChanges?: Array<{ id: string; patch: Partial<Post> }>
}
