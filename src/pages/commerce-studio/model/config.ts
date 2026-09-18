import type { AdBannerSettings, CommerceSettings, HeroVideoSettings } from './types'

export const STORAGE_KEYS = {
  // 배포된 브라우저 데이터와의 호환 계약이므로 값은 변경하지 않습니다.
  posts: 'solo-commerce-blog-posts',
  settings: 'solo-commerce-blog-settings',
  categories: 'solo-commerce-blog-categories',
  categoryImages: 'solo-commerce-blog-category-images',
  publicPosts: 'solo-commerce-blog-public-summary-v2',
  publicSettings: 'solo-commerce-blog-public-settings-v2',
  publicCategoryImages: 'solo-commerce-blog-public-category-images-v2',
  ownerPassword: 'solo-commerce-blog-owner-password',
  adminToken: 'solo-commerce-blog-admin-token',
} as const

export const CLOUD_UPDATE_CHANNEL = 'solo-commerce-blog-cloud-update'
// 함수 이름은 기존 배포 URL과 외부 링크 호환을 위해 유지합니다.
export const CLOUD_DATA_ENDPOINT = '/.netlify/functions/blog-data'
export const PRODUCTION_CLOUD_DATA_ENDPOINT = 'https://ssenshop.netlify.app/.netlify/functions/blog-data'
export const UNCATEGORIZED = '분류 없음'

export const GMARKET_SAMPLE_BANNER_IMAGE = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 104" role="img" aria-label="Gmarket sample ad banner">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#00c400"/>
      <stop offset="0.48" stop-color="#35c5f0"/>
      <stop offset="1" stop-color="#0a65ff"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" x2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1440" height="104" fill="url(#bg)"/>
  <path d="M0 87C190 58 296 114 493 75C660 42 764 82 918 55C1098 24 1254 57 1440 18V104H0Z" fill="#ffffff" opacity="0.18"/>
  <path d="M1096 -28L1270 132M1184 -28L1358 132" stroke="url(#shine)" stroke-width="34" opacity="0.35"/>
  <circle cx="132" cy="52" r="32" fill="#ffffff" opacity="0.18"/>
  <circle cx="1272" cy="52" r="42" fill="#ffffff" opacity="0.16"/>
  <text x="188" y="62" fill="#ffffff" font-family="Gmarket Sans, Arial, sans-serif" font-size="34" font-weight="900" letter-spacing="0">Gmarket</text>
  <text x="378" y="62" fill="#ffffff" font-family="Gmarket Sans, Arial, sans-serif" font-size="28" font-weight="800" letter-spacing="0">오늘만 추천 특가</text>
  <rect x="642" y="26" width="154" height="52" rx="26" fill="#ffffff"/>
  <text x="674" y="60" fill="#111827" font-family="Gmarket Sans, Arial, sans-serif" font-size="20" font-weight="900" letter-spacing="0">바로 보기</text>
  <text x="836" y="60" fill="#ffffff" font-family="Gmarket Sans, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="0">모바일까지 맞춘 와이드 띠배너</text>
</svg>
`)}`

export const GMARKET_SAMPLE_BANNER: Partial<AdBannerSettings> = {
  enabled: true,
  eyebrow: 'AD',
  title: 'Gmarket 오늘만 추천 특가',
  description: '모바일까지 맞춘 와이드 띠배너 샘플입니다.',
  ctaLabel: '바로 보기',
  href: 'https://www.gmarket.co.kr',
  image: GMARKET_SAMPLE_BANNER_IMAGE,
  backgroundColor: '#35c5f0',
  placement: 'header',
}

const createDefaultAdBanner = (index: number): AdBannerSettings => ({
  id: `banner-${index + 1}`,
  enabled: false,
  eyebrow: 'AD',
  title: `띠배너 영역 ${index + 1}`,
  description: '나중에 광고나 공지 문구를 넣을 수 있습니다.',
  ctaLabel: '자세히 보기',
  embedCode: '',
  href: '',
  image: '',
  backgroundColor: '#ffffff',
  placement: 'both',
})

export const DEFAULT_AD_BANNERS = [createDefaultAdBanner(0), createDefaultAdBanner(1)]

export const DEFAULT_HERO_VIDEO: HeroVideoSettings = {
  enabled: false,
  visibilityConfigured: false,
  youtubeUrl: '',
  eyebrow: 'NOW PLAYING',
  title: 'SSEN VIDEO PICK',
  stickerImage: '',
  stickerHref: '',
}

export const DEFAULT_SETTINGS: CommerceSettings = {
  darkMode: false,
  adBanners: DEFAULT_AD_BANNERS,
  heroVideo: DEFAULT_HERO_VIDEO,
}
