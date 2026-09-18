import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, UIEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUp, Camera, ChevronLeft, ChevronRight, ExternalLink, Mail, Share2, ShoppingBag, ShoppingCart, X, Zap } from 'lucide-react'
import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { countWords } from '../../../entities/post/lib/formatters'
import type { Post } from '../../../entities/post/model/types'
import { applyPublicSeo, getCategoryPath, getProductPath, readSeoRoute } from '../../../shared/lib/seo'
import { RenderedContent } from '../../../shared/ui/RenderedContent'
import ssenLogoImage from '../../../assets/ssen-logo.svg'
import type { AdBannerSettings, HeroVideoSettings } from '../model/useBlogStudio'

type PublicBlogHomeProps = {
  posts: Post[]
  categories: string[]
  categoryImages: Record<string, string>
  categoryFilter: string
  heroVideo: HeroVideoSettings
  adBanners: AdBannerSettings[]
  onCategoryFilterChange: (category: string) => void
  onRequestPost: (postId: string) => Promise<void>
}

const CATEGORY_COLUMN_SIZE = 2
const BEST_RANK_THEMES = [
  { accent: '#ffd54a', text: '#171717', glow: 'rgba(255, 213, 74, 0.34)', edge: '#f0002f' },
  { accent: '#dfe4ec', text: '#171717', glow: 'rgba(191, 201, 216, 0.34)', edge: '#f0002f' },
  { accent: '#d98a55', text: '#171717', glow: 'rgba(217, 138, 85, 0.32)', edge: '#171717' },
  { accent: '#f0002f', text: '#ffffff', glow: 'rgba(240, 0, 47, 0.3)', edge: '#171717' },
  { accent: '#df2847', text: '#ffffff', glow: 'rgba(223, 40, 71, 0.28)', edge: '#171717' },
  { accent: '#c93a53', text: '#ffffff', glow: 'rgba(201, 58, 83, 0.26)', edge: '#171717' },
  { accent: '#ad4659', text: '#ffffff', glow: 'rgba(173, 70, 89, 0.24)', edge: '#171717' },
  { accent: '#8f4c5c', text: '#ffffff', glow: 'rgba(143, 76, 92, 0.22)', edge: '#171717' },
  { accent: '#6f4e59', text: '#ffffff', glow: 'rgba(111, 78, 89, 0.2)', edge: '#171717' },
  { accent: '#3b3b42', text: '#ffffff', glow: 'rgba(59, 59, 66, 0.22)', edge: '#f0002f' },
] as const

function getBestRankStyle(index: number) {
  const theme = BEST_RANK_THEMES[index] ?? BEST_RANK_THEMES[BEST_RANK_THEMES.length - 1]

  return {
    '--best-rank-accent': theme.accent,
    '--best-rank-text': theme.text,
    '--best-rank-glow': theme.glow,
    '--best-rank-edge': theme.edge,
  } as CSSProperties
}

export function PublicBlogHome({
  posts,
  categories,
  categoryImages,
  categoryFilter,
  heroVideo,
  adBanners,
  onCategoryFilterChange,
  onRequestPost,
}: PublicBlogHomeProps) {
  const [selectedId, setSelectedId] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [readingProgress, setReadingProgress] = useState(0)
  const [isHeaderCompact, setIsHeaderCompact] = useState(false)
  const [isHeaderDocked, setIsHeaderDocked] = useState(false)
  const [loadingDetailId, setLoadingDetailId] = useState('')
  const [shareFeedback, setShareFeedback] = useState('')
  const headerRef = useRef<HTMLElement>(null)
  const headerSlotRef = useRef<HTMLDivElement>(null)
  const latestHeadRef = useRef<HTMLDivElement>(null)
  const pendingCategoryScrollRef = useRef<'top' | 'latest' | null>(null)
  const sliderPausedRef = useRef(false)
  const headerCompactRef = useRef(false)
  const headerDirectionLockRef = useRef(0)

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
  const categoryColumns = useMemo(() => {
    const columns: string[][] = []

    for (let index = 0; index < publicCategories.length; index += CATEGORY_COLUMN_SIZE) {
      columns.push(publicCategories.slice(index, index + CATEGORY_COLUMN_SIZE))
    }

    return columns
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
    dragSpeed: 0.5,
    mode: 'free',
    range: { align: true },
    rubberband: false,
    slides: { perView: 'auto', spacing: 3 },
  })

  useEffect(() => {
    applyPublicSeo({ category: categoryFilter, posts: publishedPosts, selectedPost })
  }, [categoryFilter, publishedPosts, selectedPost])

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
    const updateCategorySlider = () => categorySlider.current?.update()
    const frame = window.requestAnimationFrame(() => {
      updateCategorySlider()
      categorySlider.current?.moveToIdx(0, true, { duration: 0 })
    })
    window.addEventListener('resize', updateCategorySlider)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateCategorySlider)
    }
  }, [categoryColumns.length, categorySlider, isHeaderCompact])

  useEffect(() => {
    let previousScrollY = window.scrollY
    let downwardDistance = 0

    const applyHeaderMode = (compact: boolean) => {
      if (headerCompactRef.current === compact) return

      headerCompactRef.current = compact
      setIsHeaderCompact(compact)
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - previousScrollY
      const headerStart = headerSlotRef.current?.offsetTop ?? 0
      const shouldDockHeader = currentScrollY >= headerStart
      const isAtTop = currentScrollY <= 12

      setIsHeaderDocked(shouldDockHeader)

      if (!shouldDockHeader || isAtTop) {
        downwardDistance = 0
        applyHeaderMode(false)
      } else if (performance.now() >= headerDirectionLockRef.current) {
        if (delta > 1) {
          downwardDistance += delta
          if (downwardDistance >= 12) applyHeaderMode(true)
        } else if (delta < -1) {
          downwardDistance = 0
        }
      }

      previousScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (categoryFilter === 'all') return undefined

    const categoryIndex = publicCategories.indexOf(categoryFilter)
    if (categoryIndex < 0) return undefined

    const timer = window.setTimeout(() => {
      categorySlider.current?.moveToIdx(Math.floor(categoryIndex / CATEGORY_COLUMN_SIZE), true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [categoryFilter, categorySlider, publicCategories])

  const requestPostDetail = useCallback((postId: string) => {
    setLoadingDetailId(postId)
    void onRequestPost(postId).finally(() => {
      setLoadingDetailId((current) => (current === postId ? '' : current))
    })
  }, [onRequestPost])

  useEffect(() => {
    const syncViewFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search)
      const route = readSeoRoute(window.location.pathname)
      const postParam = route.product || searchParams.get('post')
      const categoryParam = route.category || searchParams.get('category')
      const targetPost = postParam ? publishedPosts.find((post) => post.slug === postParam || post.id === postParam) : undefined
      const targetCategory = categoryParam && publicCategories.includes(categoryParam) ? categoryParam : 'all'

      onCategoryFilterChange(targetCategory)
      setSelectedId(targetPost?.id ?? '')
      if (targetPost) requestPostDetail(targetPost.id)
      setReadingProgress(0)
    }

    syncViewFromUrl()
    window.addEventListener('popstate', syncViewFromUrl)

    return () => window.removeEventListener('popstate', syncViewFromUrl)
  }, [onCategoryFilterChange, publicCategories, publishedPosts, requestPostDetail])

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
    requestPostDetail(post.id)
    setReadingProgress(0)
    syncPostParam(post.slug || post.id)
  }

  const closeReader = () => {
    setSelectedId('')
    setReadingProgress(0)
    syncPostParam('', categoryFilter === 'all' ? '' : categoryFilter)
  }

  const sharePost = async (post: Post) => {
    const url = new URL(getProductPath(post.slug || post.id), window.location.origin).href
    const shareData = {
      title: `${post.title} | ${post.category} 핫템 - SSEN`,
      text: `${post.category}가 소개·착용한 ${post.title}${post.excerpt ? ` — ${post.excerpt}` : ''}`,
      url,
    }

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData)
        setShareFeedback('공유했어요')
      } else {
        await navigator.clipboard.writeText(url)
        setShareFeedback('링크 복사됨')
      }
      window.setTimeout(() => setShareFeedback(''), 1800)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        setShareFeedback('링크 복사됨')
        window.setTimeout(() => setShareFeedback(''), 1800)
      } catch {
        window.prompt('아래 상품 링크를 복사해 주세요.', url)
      }
    }
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
    if (category !== 'all') {
      headerDirectionLockRef.current = performance.now() + 900
    }

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

  const browseReaderCategory = (category: string) => {
    setSelectedId('')
    setReadingProgress(0)
    selectCategory(category)
  }

  return (
    <div className="public-blog">
      <AdStripBanners banners={adBanners} />

      <div
        ref={headerSlotRef}
        className={`public-header-slot ${isHeaderDocked && isHeaderCompact ? 'is-scroll-compact' : ''}`}
      >
      <header
        ref={headerRef}
        className={`public-header ${isHeaderDocked ? 'is-docked' : ''} ${isHeaderCompact ? 'is-scroll-compact' : ''}`}
      >
        <button className="public-brand" type="button" aria-label="전체 상품 보기" onClick={() => selectCategory('all')}>
          <span className="public-ssen-logo" aria-hidden="true">
            <img src={ssenLogoImage} alt="" />
          </span>
          <span className="public-brand-message" aria-hidden="true">
            <span className="public-brand-kicker">  지금 가장 유행하는  </span>
            <span className="public-brand-title">
              <em>쎈놈들이</em>
              <b>선택한 아이템</b>
            </span>
            <span className="public-brand-caption">SSEN</span>
          </span>
        </button>

        <nav className="public-category-nav" aria-label="셀럽별 광고 상품">
          <div className="public-category-carousel">
            <div ref={categorySliderRef} className="keen-slider public-category-page-strip">
            {categoryColumns.map((column, columnIndex) => (
              <div
                className={`keen-slider__slide public-category-column ${column.length === 1 ? 'is-single' : ''}`}
                key={`category-column-${columnIndex}`}
              >
                {column.map((category) => (
                  <button
                    className={`public-category-slide ${categoryFilter === category ? 'is-active' : ''}`}
                    data-category={category}
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
          </div>
        </nav>

      </header>
      </div>

      <TrendVideo settings={heroVideo} />

      <main className="public-main">
        <section className="public-hero public-best-v2" aria-label="실시간 상품 TOP 10">
          <div className="public-hero-copy">
            <span className="public-kicker">
              SSEN CURATED / TOP 10
            </span>
            <h1>
              <span>BEST</span>
              <em>PICKS</em>
            </h1>
            <p>오늘 가장 주목받는 아이템을 가볍게 둘러보세요.</p>
            <div className="public-best-v2-guide" aria-hidden="true">
              <strong>01 — {String(topPosts.length).padStart(2, '0')}</strong>
              <span>DRAG TO EXPLORE</span>
            </div>
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
              <div
                className="public-best-v2-confetti"
                aria-hidden="true"
                key={`best-confetti-${currentSlide}`}
                style={getBestRankStyle(currentSlide)}
              >
                {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
              </div>
              <div ref={sliderRef} className="keen-slider public-slider-track">
                {topPosts.map((post, index) => (
                  <article
                    className={`keen-slider__slide public-slide ${currentSlide === index ? 'is-current' : ''}`}
                    key={post.id}
                    style={getBestRankStyle(index)}
                  >
                    <button type="button" onClick={() => selectPost(post.id)}>
                      <div className="public-best-v2-media" data-rank={String(index + 1).padStart(2, '0')}>
                        <PostImage post={post} priority={index === 0} />
                        <strong className="public-rank">
                          <small>TOP</small>
                          <b>{String(index + 1).padStart(2, '0')}</b>
                        </strong>
                        <div className="public-best-v2-category-live">
                          <span aria-hidden="true"><i /></span>
                          <strong>{post.category}</strong>
                        </div>
                      </div>
                      <div className="public-best-v2-content">
                        <h2>{post.title}</h2>
                        <p>{post.excerpt || '지금 비교하기 좋은 상품입니다.'}</p>
                        <BestSliderPrice post={post} />
                        <div className="public-best-v2-buy">
                          <BestSliderLowestLink post={post} />
                          <em>
                            상품 상세보기 <ExternalLink size={17} />
                          </em>
                        </div>
                      </div>
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
                    className={`public-best-v2-rank-tab ${currentSlide === index ? 'is-active' : ''}`}
                    key={post.id}
                    type="button"
                    style={getBestRankStyle(index)}
                    onClick={(event) => moveSliderTo(event, index)}
                  >
                    <strong>{index + 1}</strong>
                    <span>{post.category || '분류 없음'}</span>
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

        <section
          className="public-browser"
          data-pouch-label={categoryFilter === 'all' ? 'ALL PICK' : `${categoryFilter} PICK`}
          aria-label="상품 탐색"
        >
          <div ref={latestHeadRef} className="public-section-head">
            <div>
              <span>Super Deals</span>
              <h2>
                {categoryFilter === 'all' ? 'ALL ' : `${categoryFilter} `}
                <span className="public-pick-label">PICK</span>
              </h2>
            </div>
          </div>

          {filteredPosts.length > 0 ? (
            <div className="public-post-grid">
              {filteredPosts.map((post) => (
                <a
                  aria-label={`${post.title} 상품 상세 보기`}
                  className={`public-post-card ${categoryFilter === 'all' ? 'is-all-pouch' : 'is-category-pouch'} ${selectedId === post.id ? 'is-active' : ''}`}
                  href={getProductPath(post.slug || post.id)}
                  key={post.id}
                  style={getCategoryStyle(post.category)}
                  onClick={(event) => {
                    event.preventDefault()
                    selectPost(post.id)
                  }}
                >
                  <PostImage post={post} />
                  <PouchCardOverlay post={post} showCategory={categoryFilter === 'all'} />
                </a>
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
              <button
                className="public-reader-share"
                type="button"
                aria-label={`${selectedPost.title} 공유하기`}
                onClick={() => sharePost(selectedPost)}
              >
                <Share2 size={19} aria-hidden="true" />
                {shareFeedback && <span aria-live="polite">{shareFeedback}</span>}
              </button>
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
                        <ProductImageGallery post={selectedPost} />
                      </div>
                      <div className="product-detail-summary">
                        <div className="public-reader-meta">
                          <button type="button" onClick={() => browseReaderCategory(selectedPost.category)}>
                            {selectedPost.category}
                          </button>
                        </div>
                        <Dialog.Title className={`public-reader-title ${getProductTitleSizeClass(selectedPost.title)}`}>
                          {selectedPost.title}
                        </Dialog.Title>
                        <Dialog.Description id="reader-description" className="public-reader-description">
                          {selectedPost.excerpt}
                        </Dialog.Description>
                        <ProductLinkPanel post={selectedPost} />
                        <div className="product-detail-assurance" aria-label="구매 안내">
                          <span>실시간 가격 비교</span>
                          <span>등록된 제휴몰로 바로 이동</span>
                          <span>새 창에서 안전하게 확인</span>
                        </div>
                      </div>
                    </section>
                    <section className="product-detail-body" aria-label="상품 상세 정보">
                      <div className="product-detail-side">
                        <header>
                          <span>PRODUCT STORY</span>
                          <h2>상품 상세</h2>
                          <p>구매 전에 알아두면 좋은 핵심 정보</p>
                        </header>
                        <ProductDetailSideFooter
                          post={selectedPost}
                          onCategorySelect={() => browseReaderCategory(selectedPost.category)}
                        />
                      </div>
                      {loadingDetailId === selectedPost.id ? (
                        <div className="product-detail-loading" aria-live="polite">상품 상세를 준비하고 있습니다.</div>
                      ) : (
                        <ProductDetailContent post={selectedPost} />
                      )}
                    </section>
                  </div>
                </div>
              </div>
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

      <footer className="public-footer public-footer-v3">
        <div className="public-footer-v3-main">
          <button
            className="public-footer-v3-logo"
            type="button"
            aria-label="페이지 맨 위로 이동"
            onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}
          >
            <img src={ssenLogoImage} alt="SSEN" />
          </button>

          <div className="public-footer-v3-message">
            <span>CURATED / SEOUL</span>
            <strong>PICKED BY SSEN.</strong>
          </div>

          <div className="public-footer-v3-actions">
            <button type="button" aria-label="페이지 맨 위로 이동" onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}>
              <ArrowUp size={19} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="public-footer-v3-bottom">
          <small>© {new Date().getFullYear()} SSEN</small>
          <span>SEOUL · KR</span>
        </div>
      </footer>

      <div className="public-quick-actions" aria-label="빠른 기능">
        <a href="mailto:nmc2711@naver.com" aria-label="제휴 문의 이메일 보내기">
          <Mail size={21} />
          <span>제휴 문의</span>
        </a>
      </div>
    </div>
  )
}

function CategoryVisual({ image, label }: { image?: string; label: string }) {
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

function TrendVideo({ settings }: { settings: HeroVideoSettings }) {
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
          <span>구매하기 →</span>
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

function AdStripBanners({ banners, variant = 'header' }: { banners: AdBannerSettings[]; variant?: 'header' | 'footer' }) {
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

  const content = (
    <>
      {banner.image ? (
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
      )}
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

function PostImage({ post, priority = false }: { post: Post; priority?: boolean }) {
  if (post.coverImage) {
    return (
      <img
        src={post.coverImage}
        alt=""
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        loading={priority ? 'eager' : 'lazy'}
      />
    )
  }

  return (
    <div className="public-image-fallback">
      <span>{post.title.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

function ProductImageGallery({ post }: { post: Post }) {
  const images = useMemo(
    () => [
      ...(post.coverImage ? [{ label: 'COVER', src: post.coverImage }] : []),
      ...post.detailImages.flatMap((src, index) => (
        src ? [{ label: `CUT ${String(index + 1).padStart(2, '0')}`, src }] : []
      )),
    ],
    [post.coverImage, post.detailImages],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const thumbDragRef = useRef({ active: false, moved: false, scrollLeft: 0, startX: 0 })
  const [galleryRef, gallery] = useKeenSlider<HTMLDivElement>({
    rubberband: false,
    slides: { perView: 1 },
    slideChanged(instance) {
      setActiveIndex(instance.track.details.rel)
    },
  })

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveIndex(0)
      gallery.current?.update()
      gallery.current?.moveToIdx(0, true, { duration: 0 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [gallery, images.length, post.id])

  useEffect(() => {
    const rail = thumbsRef.current
    const activeThumb = rail?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!rail || !activeThumb) return

    const nextLeft = activeThumb.offsetLeft - (rail.clientWidth - activeThumb.offsetWidth) / 2
    rail.scrollTo({ behavior: 'smooth', left: Math.max(0, nextLeft) })
  }, [activeIndex])

  const startThumbDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return

    const rail = event.currentTarget
    thumbDragRef.current = {
      active: true,
      moved: false,
      scrollLeft: rail.scrollLeft,
      startX: event.clientX,
    }
  }

  const moveThumbDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = thumbDragRef.current
    if (!drag.active) return

    const distance = event.clientX - drag.startX
    if (Math.abs(distance) > 3 && !drag.moved) {
      drag.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.classList.add('is-dragging')
    }
    if (!drag.moved) return

    event.preventDefault()
    event.currentTarget.scrollLeft = drag.scrollLeft - distance
  }

  const endThumbDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!thumbDragRef.current.active) return

    thumbDragRef.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.currentTarget.classList.remove('is-dragging')
  }

  if (images.length === 0) {
    return (
      <>
        <PostImage post={post} />
        <span className="product-gallery-pick">SSEN PICK</span>
      </>
    )
  }

  return (
    <div className="product-gallery">
      <div ref={galleryRef} className="keen-slider product-gallery-track">
        {images.map((image, index) => (
          <figure
            className={`keen-slider__slide product-gallery-slide ${activeIndex === index ? 'is-active' : ''}`}
            key={`${image.src}-${index}`}
          >
            <img
              src={image.src}
              alt={`${post.title} ${index === 0 && post.coverImage ? '대표' : `상세 ${post.coverImage ? index : index + 1}`} 이미지`}
              decoding="async"
            />
          </figure>
        ))}
      </div>

      <div className="product-gallery-topline" aria-hidden="true">
        <span>SSEN PICK</span>
        <em>{images[activeIndex]?.label}</em>
      </div>

      {images.length > 1 && (
        <>
          <div className="product-gallery-counter" aria-live="polite">
            <strong>{String(activeIndex + 1).padStart(2, '0')}</strong>
            <span>/ {String(images.length).padStart(2, '0')}</span>
          </div>
          <div className="product-gallery-arrows">
            <button type="button" aria-label="이전 상품 이미지" disabled={activeIndex === 0} onClick={() => gallery.current?.prev()}>
              <ChevronLeft size={19} />
            </button>
            <button type="button" aria-label="다음 상품 이미지" disabled={activeIndex === images.length - 1} onClick={() => gallery.current?.next()}>
              <ChevronRight size={19} />
            </button>
          </div>
          <div
            ref={thumbsRef}
            className="product-gallery-thumbs"
            aria-label="상품 이미지 선택"
            onPointerCancel={endThumbDrag}
            onPointerDown={startThumbDrag}
            onPointerMove={moveThumbDrag}
            onPointerUp={endThumbDrag}
            onWheel={(event) => {
              if (event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return
              event.preventDefault()
              event.currentTarget.scrollLeft += Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
            }}
          >
            <div className="product-gallery-thumbs-track">
              {images.map((image, index) => (
                <button
                  className={activeIndex === index ? 'is-active' : ''}
                  type="button"
                  aria-label={`${index + 1}번 이미지 보기`}
                  aria-current={activeIndex === index ? 'true' : undefined}
                  key={`${image.src.slice(0, 48)}-${index}`}
                  onClick={(event) => {
                    if (thumbDragRef.current.moved) {
                      event.preventDefault()
                      thumbDragRef.current.moved = false
                      return
                    }
                    gallery.current?.moveToIdx(index)
                  }}
                >
                  <img src={image.src} alt="" decoding="async" draggable={false} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
          <span className="product-gallery-swipe" aria-hidden="true">SWIPE TO VIEW →</span>
        </>
      )}
    </div>
  )
}

function ProductDetailContent({ post }: { post: Post }) {
  const frames = Array.from({ length: 4 }, (_, index) => ({
    description: post.detailDescriptions[index]?.trim() ?? '',
    image: post.detailImages[index] ?? '',
  }))
  const hasCompleteFourCut = frames.every((frame) => frame.image && frame.description)

  if (!hasCompleteFourCut) return <RenderedContent content={post.content} />

  return (
    <section className="ssen-four-cut" aria-label="쎈네컷 상품 상세">
      <header>
        <strong><Camera aria-hidden="true" />최저가로 구매하는데 4컷이면 충분</strong>
      </header>
      <ol>
        {frames.map((frame, index) => (
          <li data-four-cut-index={index} key={`${frame.image.slice(0, 48)}-${index}`}>
            <figure>
              <img src={frame.image} alt={`${post.title} 상세 ${index + 1}`} decoding="async" loading="lazy" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </figure>
            <div>
              <small>CUT {String(index + 1).padStart(2, '0')}</small>
              <p>{frame.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <footer>
        <span>SSEN FOUR CUT</span>
        <strong>쎈네컷</strong>
      </footer>
    </section>
  )
}

function PouchCardOverlay({ post, showCategory }: { post: Post; showCategory: boolean }) {
  const bestLink = getBestProductLink(post)
  const price = bestLink?.price.trim() || '가격 준비중'

  return (
    <div className={`public-pouch-overlay ${showCategory ? 'is-all' : 'is-category'}`}>
      {showCategory && <span>{post.category}</span>}
      <strong>
        {!showCategory && <em>{post.title}</em>}
        {showCategory && <small>최저가</small>}
        <b>{price}</b>
      </strong>
    </div>
  )
}

function BestSliderPrice({ post }: { post: Post }) {
  const bestLink = getBestProductLink(post)
  const price = bestLink?.price.trim()

  if (!price) return null

  return (
    <div className="public-best-v2-price" aria-label={`최저가 ${price}`}>
      <strong>{price}</strong>
    </div>
  )
}

function BestSliderLowestLink({ post }: { post: Post }) {
  const bestLink = getBestProductLink(post)
  const href = bestLink?.href.trim()

  if (!href) {
    return (
      <strong className="product-price-preview public-best-v2-lowest-cta">
        <Zap size={18} /> 링크 준비중
      </strong>
    )
  }

  const openLink = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    event.stopPropagation()
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <strong
      aria-label={`${bestLink.mall || '최저가 상품'} 링크로 이동`}
      className="product-price-preview public-best-v2-lowest-cta"
      role="link"
      tabIndex={0}
      onClick={openLink}
      onKeyDown={openLink}
    >
      <Zap size={18} /> 최저가 바로가기
    </strong>
  )
}

function ProductLinkPanel({ post }: { post: Post }) {
  const links = post.productLinks.filter((link) => link.href.trim())

  if (!links.length) {
    return (
      <section className="product-buy-panel is-empty">
        <div>
          <span>
            <ShoppingBag size={16} /> 구매 링크
          </span>
          <strong>등록된 구매처가 없습니다.</strong>
        </div>
      </section>
    )
  }

  const primaryLink = getBestProductLink(post) ?? links[0]
  const comparisonLinks = links.filter((link) => link.id !== primaryLink.id)

  return (
    <section className="product-buy-panel" aria-label="구매처 비교">
      <div className="product-buy-primary">
        <div className="product-buy-primary-head">
          <span>
            <Zap size={16} /> 지금 최저가
          </span>
          {primaryLink.mall.trim() && <small>{primaryLink.mall}</small>}
          <strong>{primaryLink.price || '가격 확인'}</strong>
        </div>
        <a href={primaryLink.href} target="_blank" rel="noreferrer sponsored">
          <ShoppingBag size={18} /> {primaryLink.label || '최저가 바로가기'} <ExternalLink size={16} />
        </a>
      </div>
      {comparisonLinks.length > 0 && (
        <div className="product-buy-compare">
          <div className="product-buy-compare-head">
            <strong>다른 구매처 비교</strong>
            <small>{comparisonLinks.length}곳</small>
          </div>
          <div className="product-buy-list">
            {comparisonLinks.map((link) => (
              <a href={link.href} key={link.id} target="_blank" rel="noreferrer sponsored">
                <span>
                  <b>{link.mall || '쇼핑몰'}</b>
                  {link.badge && <em>{link.badge}</em>}
                </span>
                <strong>{link.price || '가격 확인'}</strong>
                <small aria-label={`${link.mall || '쇼핑몰'}에서 확인`}>
                  <ExternalLink size={14} />
                </small>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ProductDetailSideFooter({ post, onCategorySelect }: { post: Post; onCategorySelect: () => void }) {
  const primaryLink = getBestProductLink(post)

  return (
    <aside className="product-detail-side-footer" aria-label="상품 상세 푸터">
      <button className="product-detail-side-footer-category" type="button" onClick={onCategorySelect}>
        <span>{post.category || 'SSEN PICK'}</span>
      </button>
      <div className="product-detail-side-footer-copy">
        <strong>{post.title}</strong>
        <p>{post.excerpt || '쎈이 고른 상품의 핵심 정보를 네 컷으로 확인하세요.'}</p>
      </div>
      <div className="product-detail-side-footer-price">
        <strong>{primaryLink?.price || '가격 확인'}</strong>
      </div>
      {primaryLink?.href.trim() && (
        <a href={primaryLink.href} target="_blank" rel="noreferrer sponsored">
          <span>최저가 보기</span>
          <ShoppingCart aria-hidden="true" />
        </a>
      )}
    </aside>
  )
}

function getBestProductLink(post: Post) {
  const linkedProducts = post.productLinks.filter((link) => link.href.trim())
  const pricedProducts = linkedProducts
    .map((link) => ({ link, price: parseProductPrice(link.price) }))
    .filter((entry) => Number.isFinite(entry.price))
    .sort((a, b) => a.price - b.price)

  return pricedProducts[0]?.link
    ?? linkedProducts[0]
    ?? post.productLinks.find((link) => link.price.trim())
    ?? post.productLinks[0]
}

function parseProductPrice(price: string) {
  const numericPrice = Number(price.replace(/[^\d]/g, ''))
  return numericPrice > 0 ? numericPrice : Number.POSITIVE_INFINITY
}

function getProductTitleSizeClass(title: string) {
  const length = Array.from(title.trim()).length

  if (length >= 46) return 'is-very-long'
  if (length >= 28) return 'is-long'
  return ''
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

function syncPostParam(slug: string, fallbackCategory = '') {
  const url = new URL(window.location.href)
  const basePath = url.pathname.startsWith('/blog/') ? '/blog/' : '/'

  if (slug) {
    url.pathname = `${basePath.replace(/\/$/, '')}${getProductPath(slug)}`
  } else if (fallbackCategory) {
    url.pathname = `${basePath.replace(/\/$/, '')}${getCategoryPath(fallbackCategory)}`
  } else {
    url.pathname = basePath
  }
  url.searchParams.delete('post')
  url.searchParams.delete('category')

  window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

function syncCategoryParam(category: string) {
  const url = new URL(window.location.href)
  const basePath = url.pathname.startsWith('/blog/') ? '/blog' : ''

  if (category) {
    url.pathname = `${basePath}${getCategoryPath(category)}`
  } else {
    url.pathname = `${basePath}/`
  }
  url.searchParams.delete('category')
  url.searchParams.delete('post')

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
