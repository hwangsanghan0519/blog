import type { CSSProperties, PointerEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import type { AdBannerSettings, HeroVideoSettings } from '../model/types'

export function CategoryVisual({ image, label }: { image?: string; label: string }) {
  if (image) {
    return (
      <span className="public-category-visual" style={{ '--celeb-image': `url(${image})` } as CSSProperties} aria-hidden="true">
        <img src={image} alt="" decoding="async" loading="lazy" />
      </span>
    )
  }

  return (
    <span className="public-category-visual is-fallback" aria-hidden="true">
      {label.slice(0, 1)}
    </span>
  )
}

export function TrendVideo({ settings }: { settings: HeroVideoSettings }) {
  const videoId = getYoutubeVideoId(settings.youtubeUrl)
  const isEnabled = settings.visibilityConfigured ? settings.enabled : Boolean(settings.youtubeUrl.trim())
  if (!isEnabled || !videoId) return null

  const stickerHref = getSafeExternalHref(settings.stickerHref)
  const hasSticker = Boolean(settings.stickerImage.trim() && stickerHref)

  const playerUrl = new URL(`https://www.youtube.com/embed/${videoId}`)
  playerUrl.searchParams.set('autoplay', '1')
  playerUrl.searchParams.set('mute', '1')
  playerUrl.searchParams.set('controls', '0')
  playerUrl.searchParams.set('loop', '1')
  playerUrl.searchParams.set('playlist', videoId)
  playerUrl.searchParams.set('playsinline', '1')
  playerUrl.searchParams.set('rel', '0')
  playerUrl.searchParams.set('modestbranding', '1')
  playerUrl.searchParams.set('disablekb', '1')

  return (
    <section className={`public-trend-video ${hasSticker ? 'has-sticker' : ''}`} aria-label={settings.title || '자동재생 추천 영상'}>
      <iframe
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen={false}
        loading="lazy"
        src={playerUrl.toString()}
        title={settings.title || 'SSEN 추천 영상'}
      />
      <div className="public-trend-video-shade" aria-hidden="true" />
      {hasSticker && (
        <a
          className="public-trend-video-sticker"
          href={stickerHref}
          target="_blank"
          rel="sponsored noopener noreferrer"
          aria-label="추천 상품 링크 새 창에서 열기"
        >
          <img src={settings.stickerImage} alt="" decoding="async" loading="lazy" />
          <span>구매하기 <ExternalLink size={12} aria-hidden="true" /></span>
        </a>
      )}
      <div className="public-trend-video-copy">
        <span>{settings.eyebrow || 'NOW PLAYING'}</span>
        <strong>{settings.title || 'SSEN VIDEO PICK'}</strong>
      </div>
      <div className="public-trend-video-status" aria-hidden="true">
        <i /> MUTED · AUTO PLAY
      </div>
    </section>
  )
}

export function AdStripBanners({ banners, variant = 'header' }: { banners: AdBannerSettings[]; variant?: 'header' | 'footer' }) {
  const visibleBanners = banners.filter((banner) => banner.enabled && (banner.placement === 'both' || banner.placement === variant))

  if (!visibleBanners.length) return null
  const hasVisualBanner = visibleBanners.some((banner) => banner.image || banner.embedCode.trim())

  return (
    <div className={`public-ad-stack ${variant === 'footer' ? 'is-footer' : ''} ${hasVisualBanner ? 'has-image-banner' : ''}`}>
      {visibleBanners.map((banner) => (
        <AdStripBanner banner={banner} key={banner.id} variant={variant} />
      ))}
    </div>
  )
}

function getSafeExternalHref(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function getYoutubeVideoId(value: string) {
  const source = value.trim()
  if (!source) return ''
  const isVideoId = (candidate: string) => /^[\w-]{11}$/.test(candidate)
  if (isVideoId(source)) return source

  try {
    const url = new URL(source)
    const hostname = url.hostname.replace(/^www\./, '')
    let candidate = ''

    if (hostname === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? ''
    } else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') {
        candidate = url.searchParams.get('v') ?? ''
      } else {
        const [, route, id] = url.pathname.split('/')
        candidate = ['embed', 'shorts', 'live'].includes(route) ? id ?? '' : ''
      }
    }

    return isVideoId(candidate) ? candidate : ''
  } catch {
    return ''
  }
}

function moveAdSpotlight(event: PointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - bounds.left) / bounds.width) * 100
  const y = ((event.clientY - bounds.top) / bounds.height) * 100

  event.currentTarget.style.setProperty('--ad-pointer-x', `${x}%`)
  event.currentTarget.style.setProperty('--ad-pointer-y', `${y}%`)
}

function resetAdSpotlight(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--ad-pointer-x', '50%')
  event.currentTarget.style.setProperty('--ad-pointer-y', '50%')
}

function AdStripBanner({ banner, variant }: { banner: AdBannerSettings; variant: 'header' | 'footer' }) {
  if (!banner.enabled) return null
  const embedCode = banner.embedCode.trim()
  const className = `public-ad-strip ${embedCode ? 'has-embed' : banner.image ? 'has-image' : ''}`
  const bannerStyle = {
    '--ad-banner-bg': banner.backgroundColor || '#ffffff',
    ...(banner.image ? { '--ad-banner-image': `url(${JSON.stringify(banner.image)})` } : {}),
    ...(embedCode ? { '--ad-embed-height': `${getAdEmbedHeight(embedCode, variant)}px` } : {}),
  } as CSSProperties

  if (embedCode) {
    return (
      <div className={className} style={bannerStyle}>
        <iframe
          className="public-ad-embed-frame"
          loading={variant === 'header' ? 'eager' : 'lazy'}
          sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts"
          srcDoc={createAdEmbedDocument(embedCode, banner.backgroundColor)}
          title={`${banner.title || '제휴 광고'} ${variant === 'header' ? '상단' : '하단'} 배너`}
        />
      </div>
    )
  }

  const content = banner.image ? (
    <figure>
      <img src={banner.image} alt="" decoding="async" loading="lazy" />
    </figure>
  ) : (
    <>
      <div>
        <span>{banner.eyebrow || 'AD'}</span>
        <strong>{banner.title || '띠배너 영역'}</strong>
        <p>{banner.description}</p>
      </div>
      {banner.ctaLabel && <em>{banner.ctaLabel}</em>}
    </>
  )

  if (banner.href.trim()) {
    return (
      <a
        className={className}
        href={banner.href}
        style={bannerStyle}
        target="_blank"
        rel="noreferrer"
        onPointerMove={moveAdSpotlight}
        onPointerLeave={resetAdSpotlight}
      >
        {content}
      </a>
    )
  }

  return (
    <div className={className} style={bannerStyle} onPointerMove={moveAdSpotlight} onPointerLeave={resetAdSpotlight}>
      {content}
    </div>
  )
}

function getAdEmbedHeight(code: string, variant: 'header' | 'footer') {
  const iframeHeight = code.match(/<iframe\b[^>]*\bheight\s*=\s*["']?(\d+)/i)?.[1]
  const dataHeight = code.match(/\bdata-height\s*=\s*["']?(\d+)/i)?.[1]
  const height = Number(iframeHeight ?? dataHeight ?? (variant === 'header' ? 120 : 100))
  return Math.min(600, Math.max(50, Number.isFinite(height) ? height : 120))
}

/** 광고 태그는 부모 문서 권한을 얻지 못하는 별도 문서로 실행합니다. */
function createAdEmbedDocument(code: string, backgroundColor: string) {
  const background = /^#[0-9a-f]{3,8}$/i.test(backgroundColor.trim()) ? backgroundColor.trim() : 'transparent'
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body { width: 100%; min-height: 100%; margin: 0; overflow: hidden; background: ${background}; }
      body { display: flex; align-items: center; justify-content: center; }
      iframe, img { max-width: 100%; border: 0; }
    </style>
  </head>
  <body>${code}</body>
</html>`
}
