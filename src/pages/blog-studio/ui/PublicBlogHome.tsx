import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent, UIEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Mail, ShoppingBag, Trophy, X, Zap } from 'lucide-react'
import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { countWords, formatDate } from '../../../entities/post/lib/formatters'
import type { Post } from '../../../entities/post/model/types'
import { RenderedContent } from '../../../shared/ui/RenderedContent'
import ssenLogoImage from '../../../assets/ssen-logo.svg'
import type { AdBannerSettings } from '../model/useBlogStudio'

type PublicBlogHomeProps = {
  posts: Post[]
  categories: string[]
  categoryImages: Record<string, string>
  categoryFilter: string
  adBanners: AdBannerSettings[]
  onCategoryFilterChange: (category: string) => void
}

export function PublicBlogHome({
  posts,
  categories,
  categoryImages,
  categoryFilter,
  adBanners,
  onCategoryFilterChange,
}: PublicBlogHomeProps) {
  const [selectedId, setSelectedId] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [readingProgress, setReadingProgress] = useState(0)
  const headerRef = useRef<HTMLElement>(null)
  const latestHeadRef = useRef<HTMLDivElement>(null)
  const pendingCategoryScrollRef = useRef<'top' | 'latest' | null>(null)
  const sliderPausedRef = useRef(false)

  const publishedPosts = useMemo(
    () =>
      posts
        .filter((post) => post.status === 'published')
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [posts],
  )

  const topPosts = useMemo(() => getTopPosts(publishedPosts), [publishedPosts])
  const publicCategories = useMemo(
    () => categories.filter((category) => category.trim()),
    [categories],
  )
  const categoryPages = useMemo(() => {
    const pages: string[][] = []

    for (let index = 0; index < publicCategories.length; index += 7) {
      pages.push(publicCategories.slice(index, index + 7))
    }

    return pages
  }, [publicCategories])
  const categoryCounts = useMemo(() => {
    return publishedPosts.reduce<Record<string, number>>((counts, post) => {
      counts[post.category] = (counts[post.category] ?? 0) + 1
      return counts
    }, {})
  }, [publishedPosts])

  const filteredPosts = useMemo(() => {
    return publishedPosts
      .filter((post) => categoryFilter === 'all' || post.category === categoryFilter)
  }, [categoryFilter, publishedPosts])

  const selectedPost = publishedPosts.find((post) => post.id === selectedId)
  const selectedPostIndex = selectedPost ? publishedPosts.findIndex((post) => post.id === selectedPost.id) : -1
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    loop: topPosts.length > 1,
    slides: { perView: 1, spacing: 18 },
    slideChanged(instance) {
      setCurrentSlide(instance.track.details.rel)
    },
  })
  const [categorySliderRef, categorySlider] = useKeenSlider<HTMLDivElement>({
    rubberband: true,
    slides: { perView: 1, spacing: 0 },
  })

  useEffect(() => {
    if (topPosts.length < 2) return undefined

    const timer = window.setInterval(() => {
      if (!sliderPausedRef.current) {
        slider.current?.next()
      }
    }, 4500)

    return () => window.clearInterval(timer)
  }, [slider, topPosts.length])

  useEffect(() => {
    categorySlider.current?.update()
  }, [categoryPages.length, categorySlider])

  useEffect(() => {
    const syncViewFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search)
      const postParam = searchParams.get('post')
      const categoryParam = searchParams.get('category')
      const targetPost = postParam ? publishedPosts.find((post) => post.slug === postParam || post.id === postParam) : undefined
      const targetCategory = categoryParam && publicCategories.includes(categoryParam) ? categoryParam : 'all'

      onCategoryFilterChange(targetCategory)
      setSelectedId(targetPost?.id ?? '')
      setReadingProgress(0)
    }

    syncViewFromUrl()
    window.addEventListener('popstate', syncViewFromUrl)

    return () => window.removeEventListener('popstate', syncViewFromUrl)
  }, [onCategoryFilterChange, publicCategories, publishedPosts])

  useEffect(() => {
    const pendingScroll = pendingCategoryScrollRef.current
    if (!pendingScroll) return undefined

    pendingCategoryScrollRef.current = null

    // 필터링된 상품 목록이 화면에 반영된 다음 정확한 위치로 이동합니다.
    const timer = window.setTimeout(() => {
      if (pendingScroll === 'top') {
        window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
        return
      }

      scrollToHeaderEdge(latestHeadRef.current, headerRef.current)
    }, 40)

    return () => window.clearTimeout(timer)
  }, [categoryFilter, filteredPosts.length])

  const selectPost = (postId: string) => {
    const post = publishedPosts.find((item) => item.id === postId)
    if (!post) return

    setSelectedId(post.id)
    setReadingProgress(0)
    syncPostParam(post.slug || post.id)
  }

  const closeReader = () => {
    setSelectedId('')
    setReadingProgress(0)
    syncPostParam('')
  }

  const moveReaderPost = (direction: -1 | 1) => {
    if (selectedPostIndex < 0) return

    const nextIndex = selectedPostIndex + direction
    const nextPost = publishedPosts[nextIndex]
    if (nextPost) {
      selectPost(nextPost.id)
    }
  }

  const moveSlider = (event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.preventDefault()
    event.stopPropagation()
    if (direction < 0) {
      slider.current?.prev()
      return
    }

    slider.current?.next()
  }

  const moveSliderTo = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault()
    event.stopPropagation()
    slider.current?.moveToIdx(index)
  }

  const stopReaderControlEvent = (event: MouseEvent<HTMLButtonElement> | PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const moveReaderPostFromControl = (event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    stopReaderControlEvent(event)
    moveReaderPost(direction)
  }

  const updateReadingProgress = (event: UIEvent<HTMLElement>) => {
    const target = event.currentTarget
    const maxScroll = target.scrollHeight - target.clientHeight
    setReadingProgress(maxScroll > 0 ? Math.min(100, Math.round((target.scrollTop / maxScroll) * 100)) : 100)
  }

  // 이전/다음 버튼은 화면상 모달 밖에 두되, Dialog의 바깥 클릭 닫힘으로 처리되지 않게 제외합니다.
  const keepReaderOpenForNavControls = (event: {
    target: EventTarget | null
    preventDefault: () => void
    stopPropagation?: () => void
  }) => {
    if (event.target instanceof Element && event.target.closest('.public-reader-outer-controls')) {
      event.preventDefault()
      event.stopPropagation?.()
    }
  }

  const selectCategory = (category: string) => {
    onCategoryFilterChange(category)
    syncCategoryParam(category === 'all' ? '' : category)

    if (category === 'all') {
      pendingCategoryScrollRef.current = 'top'
      window.setTimeout(() => {
        if (pendingCategoryScrollRef.current === 'top') {
          pendingCategoryScrollRef.current = null
          window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
        }
      }, 40)
      return
    }

    pendingCategoryScrollRef.current = 'latest'
    window.setTimeout(() => {
      if (pendingCategoryScrollRef.current === 'latest') {
        pendingCategoryScrollRef.current = null
        scrollToHeaderEdge(latestHeadRef.current, headerRef.current)
      }
    }, 40)
  }

  return (
    <div className="public-blog">
      <header ref={headerRef} className="public-header">
        <button className="public-brand" type="button" aria-label="SSEN 홈" onClick={() => selectCategory('all')}>
          <span className="public-ssen-logo" aria-hidden="true">
            <img src={ssenLogoImage} alt="" />
          </span>
        </button>

        <nav className="public-category-nav" aria-label="셀럽별 광고 상품">
          <button
            className={`public-category-all ${categoryFilter === 'all' ? 'is-active' : ''}`}
            style={getCategoryStyle('전체')}
            type="button"
            onClick={() => selectCategory('all')}
          >
            전체
            <small>{publishedPosts.length}</small>
          </button>
          <div
            ref={categorySliderRef}
            className="keen-slider public-category-track"
          >
            {categoryPages.map((page, pageIndex) => (
              <div className="keen-slider__slide public-category-page" key={`category-page-${pageIndex}`}>
                {page.map((category) => (
                  <button
                    className={`public-category-slide ${categoryFilter === category ? 'is-active' : ''}`}
                    key={category}
                    style={getCategoryStyle(category)}
                    type="button"
                    onClick={() => selectCategory(category)}
                  >
                    <CategoryVisual image={categoryImages[category]} label={category} />
                    <span>CELEB</span>
                    <strong>{category}</strong>
                    <small>{categoryCounts[category] ?? 0}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </nav>

      </header>

      <AdStripBanners banners={adBanners} />

      <main className="public-main">
        <section className="public-hero" aria-label="실시간 상품 TOP 10">
          <div className="public-hero-copy">
            <span className="public-kicker">
              <Trophy size={16} /> 오늘의 센 가격 TOP 10
            </span>
            <h1>SSEN PRICE DROP</h1>
            <p>셀럽과 인플루언서가 광고한 상품을 모아 보고, 판매사 링크로 바로 이동합니다.</p>

          </div>

          {topPosts.length > 0 ? (
            <div
              className="public-hero-slider"
              onMouseEnter={() => {
                sliderPausedRef.current = true
              }}
              onMouseLeave={() => {
                sliderPausedRef.current = false
              }}
            >
              <div ref={sliderRef} className="keen-slider public-slider-track">
                {topPosts.map((post, index) => (
                  <article className="keen-slider__slide public-slide" key={post.id}>
                    <button type="button" onClick={() => selectPost(post.id)}>
                      <PostImage post={post} />
                      <strong className="public-rank">TOP {index + 1}</strong>
                      <span>{post.category}</span>
                      <h2>{post.title}</h2>
                      <p>{post.excerpt || '지금 비교하기 좋은 상품입니다.'}</p>
                      <ProductPricePreview post={post} />
                      <em>가격 보기</em>
                    </button>
                  </article>
                ))}
              </div>
              <div className="public-slider-controls">
                <button type="button" aria-label="이전 추천 상품" disabled={topPosts.length < 2} onClick={(event) => moveSlider(event, -1)}>
                  <ChevronLeft size={18} />
                </button>
                <span className="public-slider-count">
                  <strong>{String(currentSlide + 1).padStart(2, '0')}</strong>
                  <small>/ {String(topPosts.length).padStart(2, '0')}</small>
                </span>
                <button type="button" aria-label="다음 추천 상품" disabled={topPosts.length < 2} onClick={(event) => moveSlider(event, 1)}>
                  <ChevronRight size={18} />
                </button>
                <div className="public-slider-dots" aria-label="TOP 10 상품 위치">
                  {topPosts.map((post, index) => (
                    <button
                      className={currentSlide === index ? 'is-active' : ''}
                      key={post.id}
                      type="button"
                      aria-label={`TOP ${index + 1} 상품 보기`}
                      onClick={(event) => moveSliderTo(event, index)}
                    />
                  ))}
                </div>
              </div>
              <div className="public-top-strip" aria-label="TOP 10 상품 빠른 선택">
                {topPosts.map((post, index) => (
                  <button
                    className={currentSlide === index ? 'is-active' : ''}
                    key={post.id}
                    type="button"
                    onClick={(event) => moveSliderTo(event, index)}
                  >
                    <strong>{index + 1}</strong>
                    <span>{post.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="public-empty public-hero-empty">
              <strong>아직 공개된 상품이 없습니다.</strong>
              <p>곧 강한 가격의 딜이 이곳에 채워질 예정입니다.</p>
            </div>
          )}
        </section>

        <section className="public-browser" aria-label="상품 탐색">
          <div ref={latestHeadRef} className="public-section-head">
            <div>
              <span>Fresh Deals</span>
              <h2>최근 상품</h2>
            </div>
          </div>

          {filteredPosts.length > 0 ? (
            <div className="public-post-grid">
              {filteredPosts.map((post) => (
                <button
                  className={`public-post-card ${selectedId === post.id ? 'is-active' : ''}`}
                  key={post.id}
                  style={getCategoryStyle(post.category)}
                  type="button"
                  onClick={() => selectPost(post.id)}
                >
                  <PostImage post={post} />
                  <span>{post.category}</span>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt || '지금 가격을 비교해보세요.'}</p>
                  <ProductPricePreview post={post} />
                  <small>
                    <CalendarDays size={14} /> {formatDate(post.updatedAt)}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="public-empty">
              <strong>조건에 맞는 상품이 없습니다.</strong>
              <p>다른 셀럽을 선택하면 해당 인물이 광고한 상품을 볼 수 있습니다.</p>
            </div>
          )}
        </section>

      </main>

      <Dialog.Root open={Boolean(selectedPost)} onOpenChange={(open) => !open && closeReader()}>
        <Dialog.Portal>
          <Dialog.Overlay className="public-reader-backdrop" />
          {selectedPost && (
            <Dialog.Content
              className="public-reader"
              style={{ '--reader-progress': `${readingProgress}%` } as CSSProperties}
              aria-describedby="reader-description"
              onInteractOutside={keepReaderOpenForNavControls}
              onPointerDownOutside={keepReaderOpenForNavControls}
            >
              <Dialog.Close className="public-reader-close" aria-label="상품 상세 닫기">
                <X size={20} />
              </Dialog.Close>
              <div
                className="public-reader-progress"
                aria-label={`읽은 위치 ${readingProgress}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={readingProgress}
                role="progressbar"
              />
              <div className="public-reader-scroll" onScroll={updateReadingProgress}>
                <div className="public-reader-book">
                  <div className="public-reader-page">
                    <section className="product-detail-hero" style={getCategoryStyle(selectedPost.category)}>
                      <div className="product-detail-image">
                        <PostImage post={selectedPost} />
                        <span>SSEN PICK</span>
                      </div>
                      <div className="product-detail-summary">
                        <div className="public-reader-meta">
                          <span>{selectedPost.category}</span>
                          <span>{formatDate(selectedPost.updatedAt)}</span>
                        </div>
                        <Dialog.Title className="public-reader-title">{selectedPost.title}</Dialog.Title>
                        <ProductPricePreview post={selectedPost} />
                        <ProductLinkPanel post={selectedPost} />
                        <Dialog.Description id="reader-description" className="public-reader-description">
                          {selectedPost.excerpt}
                        </Dialog.Description>
                        <div className="public-reader-tags">
                          {selectedPost.tags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </section>
                    <RenderedContent content={selectedPost.content} />
                  </div>
                </div>
              </div>
              <ProductBottomBuyBar post={selectedPost} />
            </Dialog.Content>
          )}
          {selectedPost && (
            <div className="public-reader-outer-controls" aria-label="상품 이동">
              {selectedPostIndex > 0 && (
                <button
                  className="public-reader-nav-button is-prev"
                  type="button"
                  aria-label="이전 상품"
                  onPointerDown={stopReaderControlEvent}
                  onClick={(event) => moveReaderPostFromControl(event, -1)}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {selectedPostIndex < publishedPosts.length - 1 && (
                <button
                  className="public-reader-nav-button is-next"
                  type="button"
                  aria-label="다음 상품"
                  onPointerDown={stopReaderControlEvent}
                  onClick={(event) => moveReaderPostFromControl(event, 1)}
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          )}
        </Dialog.Portal>
      </Dialog.Root>

      <AdStripBanners banners={adBanners} variant="footer" />

      <footer className="public-footer">
        <div className="public-footer-copy">
          <span>SSEN DROP CLUB</span>
          <strong>SSEN</strong>
          <p>강한 제품, 더 강한 가격, 바로 이동 가능한 제휴 링크를 큐레이션합니다.</p>
          <div className="public-footer-tags" aria-label="SSEN 키워드">
            <span>RED DROP</span>
            <span>K-POP MOOD</span>
            <span>AFFILIATE SELECT</span>
          </div>
        </div>

        <div className="public-footer-bottom">
          <small>© {new Date().getFullYear()} SSEN | Contact nmc2711@naver.com</small>
          <button type="button" onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}>
            TOP
          </button>
        </div>
      </footer>

      <div className="public-quick-actions" aria-label="빠른 기능">
        <a href="mailto:nmc2711@naver.com" aria-label="이메일로 문의하기">
          <Mail size={21} />
          <span>Contact</span>
        </a>
      </div>
    </div>
  )
}

function CategoryVisual({ image, label }: { image?: string; label: string }) {
  if (image) {
    return (
      <span className="public-category-visual" style={{ '--celeb-image': `url(${image})` } as CSSProperties} aria-hidden="true">
        <img src={image} alt="" />
      </span>
    )
  }

  return (
    <span className="public-category-visual is-fallback" aria-hidden="true">
      {label.slice(0, 1)}
    </span>
  )
}

function AdStripBanners({ banners, variant = 'header' }: { banners: AdBannerSettings[]; variant?: 'header' | 'footer' }) {
  const visibleBanners = banners.filter((banner) => banner.enabled && (banner.placement === 'both' || banner.placement === variant))

  if (!visibleBanners.length) return null
  const hasImageBanner = visibleBanners.some((banner) => banner.image)

  return (
    <div className={`public-ad-stack ${variant === 'footer' ? 'is-footer' : ''} ${hasImageBanner ? 'has-image-banner' : ''}`}>
      {visibleBanners.map((banner) => (
        <AdStripBanner banner={banner} key={banner.id} />
      ))}
    </div>
  )
}

function AdStripBanner({ banner }: { banner: AdBannerSettings }) {
  if (!banner.enabled) return null
  const className = `public-ad-strip ${banner.image ? 'has-image' : ''}`
  const bannerStyle = { '--ad-banner-bg': banner.backgroundColor || '#ffffff' } as CSSProperties

  const content = (
    <>
      {banner.image ? (
        <figure>
          <img src={banner.image} alt="" />
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
      )}
    </>
  )

  if (banner.href.trim()) {
    return (
      <a className={className} href={banner.href} style={bannerStyle} target="_blank" rel="noreferrer">
        {content}
      </a>
    )
  }

  return (
    <div className={className} style={bannerStyle}>
      {content}
    </div>
  )
}

function PostImage({ post }: { post: Post }) {
  if (post.coverImage) {
    return <img src={post.coverImage} alt="" />
  }

  return (
    <div className="public-image-fallback">
      <span>{post.title.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

function ProductPricePreview({ post }: { post: Post }) {
  const bestLink = getBestProductLink(post)

  if (!bestLink) {
    return (
      <strong className="product-price-preview">
        <Zap size={15} /> 가격 준비중
      </strong>
    )
  }

  return (
    <strong className="product-price-preview">
      <Zap size={15} /> <span>최저가</span> {bestLink.price || '가격 확인'} <small>{bestLink.mall}</small>
    </strong>
  )
}

function ProductLinkPanel({ post }: { post: Post }) {
  const links = post.productLinks.filter((link) => link.href.trim())

  if (!links.length) {
    return (
      <section className="product-buy-panel">
        <div>
          <span>
            <ShoppingBag size={16} /> 구매 링크
          </span>
          <strong>등록된 구매처가 없습니다.</strong>
        </div>
      </section>
    )
  }

  return (
    <section className="product-buy-panel" aria-label="구매처 비교">
      <div>
        <span>
          <ShoppingBag size={16} /> 따라다니는 구매 버튼
        </span>
        <strong>최저가 제휴 링크로 바로 이동하세요.</strong>
      </div>
      <div className="product-buy-list">
        {links.map((link, index) => (
          <a className={index === 0 ? 'is-primary' : ''} href={link.href} key={link.id} target="_blank" rel="noreferrer sponsored">
            <span>
              <b>{link.mall || '쇼핑몰'}</b>
              <em>{index === 0 ? '최저가' : link.badge || '비교가'}</em>
            </span>
            <strong>{link.price || '가격 확인'}</strong>
            <small>
              {link.label || '구매하러 가기'} <ExternalLink size={14} />
            </small>
          </a>
        ))}
      </div>
    </section>
  )
}

function ProductBottomBuyBar({ post }: { post: Post }) {
  const links = post.productLinks.filter((link) => link.href.trim())

  if (!links.length) return null

  return (
    <nav className="product-bottom-buy-bar" aria-label="제휴몰 바로가기">
      <strong>{post.purchaseTitle || '최저가 제휴몰 바로가기'}</strong>
      <div>
        {links.map((link, index) => (
          <a className={index === 0 ? 'is-primary' : ''} href={link.href} key={link.id} target="_blank" rel="noreferrer sponsored">
            <span>{link.mall || '쇼핑몰'}</span>
            <b>{link.price || '가격 확인'}</b>
          </a>
        ))}
      </div>
    </nav>
  )
}

function getBestProductLink(post: Post) {
  return post.productLinks.find((link) => link.price || link.href) ?? post.productLinks[0]
}

function getTopPosts(posts: Post[]) {
  return [...posts]
    .sort((a, b) => {
      const score = (post: Post) => countWords(post.content) + post.tags.length * 20 + (post.coverImage ? 120 : 0)
      return score(b) - score(a)
    })
    .slice(0, 10)
}

function scrollToHeaderEdge(target: HTMLElement | null, header: HTMLElement | null) {
  if (!target) return

  const headerHeight = Math.ceil(header?.getBoundingClientRect().height ?? 0)
  const targetTop = target.getBoundingClientRect().top + window.scrollY

  window.scrollTo({
    top: Math.max(0, targetTop - headerHeight),
    behavior: 'smooth',
  })
}

function syncPostParam(slug: string) {
  const url = new URL(window.location.href)

  if (slug) {
    url.searchParams.set('post', slug)
  } else {
    url.searchParams.delete('post')
  }

  window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function syncCategoryParam(category: string) {
  const url = new URL(window.location.href)

  if (category) {
    url.searchParams.set('category', category)
  } else {
    url.searchParams.delete('category')
  }

  window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

const CATEGORY_PALETTE = [
  ['#e21b2d', '#fff1f2'],
  ['#111827', '#f3f4f6'],
  ['#ffb800', '#fff7d6'],
  ['#f97316', '#fff0df'],
  ['#2563eb', '#eaf1ff'],
  ['#16a34a', '#eaf8ee'],
] as const

function getCategoryStyle(category: string): CSSProperties {
  const hash = Array.from(category).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const [accent, tint] = CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length]

  return {
    '--category-accent': accent,
    '--category-tint': tint,
  } as CSSProperties
}
