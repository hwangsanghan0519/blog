import { normalizeProductSource } from '../../../entities/post/lib/source'
import type { Post, PostStatus, ProductLink } from '../../../entities/post/model/types'
import { loadJson } from '../../../shared/lib/storage'
import {
  DEFAULT_AD_BANNERS,
  DEFAULT_HERO_VIDEO,
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  UNCATEGORIZED,
} from '../model/config'
import type { AdBannerSettings, CommerceSettings, HeroVideoSettings } from '../model/types'

/** 사용자 입력과 이전 버전 백업을 현재 카테고리 형식으로 정규화합니다. */
export function normalizeCategoryName(value: string | null) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

export function normalizeCategories(values: unknown) {
  if (!Array.isArray(values)) return []

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeCategoryName(value))
        .filter(Boolean),
    ),
  )
}

export function normalizeCategoryImages(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([category, image]) => [normalizeCategoryName(category), typeof image === 'string' ? image : ''] as const)
      .filter(([category, image]) => category && image),
  )
}

export function uniqueCategories(posts: Post[]) {
  const names = posts.map((post) => normalizeCategoryName(post.category) || UNCATEGORIZED)
  return normalizeCategories(names)
}

/** 신뢰할 수 없는 서버/백업 데이터를 완전한 Post 모델로 복구합니다. */
export function normalizePosts(values: unknown, categoryHints: unknown = []): Post[] {
  if (!Array.isArray(values)) return []

  const fallbackCategory = normalizeCategories(categoryHints)[0] ?? UNCATEGORIZED

  return values
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')
    .map((value, index) => {
      const category = normalizeCategoryName(readString(value.category, fallbackCategory)) || fallbackCategory

      return {
        id: readString(value.id, `post-${Date.now()}-${index}`),
        title: readString(value.title, '이름 없는 상품'),
        slug: readString(value.slug, `product-${Date.now()}-${index}`),
        excerpt: readString(value.excerpt, ''),
        category,
        tags: Array.isArray(value.tags)
          ? value.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
          : [],
        content: readString(value.content, '<h1>새 글</h1><p></p>'),
        source: normalizeProductSource(value.source),
        coverImage: readString(value.coverImage, ''),
        detailImages: normalizeFixedStringSlots(value.detailImages, 4),
        detailDescriptions: normalizeFixedStringSlots(value.detailDescriptions, 4),
        purchaseTitle: readString(value.purchaseTitle, '보러가기'),
        productLinks: normalizeProductLinks(value.productLinks),
        status: normalizePostStatus(value.status),
        createdAt: readString(value.createdAt, new Date().toISOString()),
        updatedAt: readString(value.updatedAt, new Date().toISOString()),
      }
    })
}

export function readSettings(storageKey: string = STORAGE_KEYS.settings): CommerceSettings {
  const stored = loadJson<Partial<CommerceSettings> & { adBanner?: AdBannerSettings }>(storageKey, DEFAULT_SETTINGS)

  return {
    darkMode: stored.darkMode ?? DEFAULT_SETTINGS.darkMode,
    adBanners: stored.adBanners?.length
      ? normalizeAdBanners(stored.adBanners)
      : normalizeAdBanners(stored.adBanner ? [stored.adBanner] : []),
    heroVideo: normalizeHeroVideo(stored.heroVideo),
  }
}

export function normalizeAdBanners(banners: Partial<AdBannerSettings>[]) {
  const normalized = DEFAULT_AD_BANNERS.map((fallback, index) => ({
    ...fallback,
    ...banners[index],
    embedCode: typeof banners[index]?.embedCode === 'string' ? banners[index].embedCode : '',
    id: banners[index]?.id ?? fallback.id,
  }))

  return normalized
}

export function normalizeHeroVideo(value?: Partial<HeroVideoSettings>): HeroVideoSettings {
  const youtubeUrl = typeof value?.youtubeUrl === 'string' ? value.youtubeUrl : ''
  const visibilityConfigured = Boolean(value?.visibilityConfigured)

  return {
    ...DEFAULT_HERO_VIDEO,
    ...value,
    enabled: visibilityConfigured ? Boolean(value?.enabled) : Boolean(youtubeUrl.trim()),
    eyebrow: typeof value?.eyebrow === 'string' ? value.eyebrow : DEFAULT_HERO_VIDEO.eyebrow,
    // Refresh the previous brand's saved default in both local caches and cloud snapshots.
    title: typeof value?.title === 'string' && !['VIOLE VIDEO PICK', 'CELEB HOUSE VIDEO PICK'].includes(value.title.trim())
      ? value.title
      : DEFAULT_HERO_VIDEO.title,
    stickerImage: typeof value?.stickerImage === 'string' ? value.stickerImage : '',
    stickerHref: typeof value?.stickerHref === 'string' ? value.stickerHref : '',
    visibilityConfigured,
    youtubeUrl,
  }
}

export function isPostTemplate(value: unknown): value is Partial<Post> {
  if (!value || typeof value !== 'object') return true
  if ('nativeEvent' in value || 'currentTarget' in value || 'target' in value) return false

  return true
}

function normalizeFixedStringSlots(values: unknown, length: number) {
  return Array.from({ length }, (_, index) => (
    Array.isArray(values) && typeof values[index] === 'string' ? values[index] : ''
  ))
}

function normalizeProductLinks(values: unknown): ProductLink[] {
  if (!Array.isArray(values)) return []

  return values
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')
    .map((value, index) => ({
      id: readString(value.id, `link-${Date.now()}-${index}`),
      mall: readString(value.mall, ''),
      price: readString(value.price, ''),
      label: readString(value.label, ''),
      href: readString(value.href, ''),
      badge: readString(value.badge, ''),
    }))
    .filter((link) => link.mall || link.price || link.href)
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function normalizePostStatus(value: unknown): PostStatus {
  return value === 'draft' || value === 'published' || value === 'archived' ? value : 'draft'
}
