import type { Post } from '../../../entities/post/model/types'
import type { AdBannerSettings, HeroVideoSettings } from '../model/types'

/** 스토어프런트 캐시는 큰 인라인 이미지를 제외해 메인 스레드 직렬화 비용을 제한합니다. */
export function createLightweightPostCache(posts: Post[]) {
  return posts.map((post) => ({
    ...post,
    content: '',
    coverImage: isEmbeddedImage(post.coverImage) ? '' : post.coverImage,
    detailImages: post.detailImages.map((image) => (isEmbeddedImage(image) ? '' : image)),
  }))
}

export function createLightweightBannerCache(banners: AdBannerSettings[]) {
  return banners.map((banner) => ({
    ...banner,
    image: isEmbeddedImage(banner.image) ? '' : banner.image,
  }))
}

export function createLightweightHeroVideoCache(settings: HeroVideoSettings): HeroVideoSettings {
  return {
    ...settings,
    stickerImage: isEmbeddedImage(settings.stickerImage) ? '' : settings.stickerImage,
  }
}

export function stripEmbeddedImages(images: Record<string, string>) {
  return Object.fromEntries(Object.entries(images).filter(([, image]) => !isEmbeddedImage(image)))
}

function isEmbeddedImage(value: string) {
  return value.startsWith('data:image/')
}
