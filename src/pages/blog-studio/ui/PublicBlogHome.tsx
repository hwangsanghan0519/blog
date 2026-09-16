import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, UIEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CalendarDays, ChevronLeft, ChevronRight, Mail, Search, Trophy, X } from 'lucide-react'
import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { normalizeEditorContent } from '../../../entities/post/lib/content'
import { countWords, formatDate } from '../../../entities/post/lib/formatters'
import type { Post } from '../../../entities/post/model/types'
import type { AdBannerSettings } from '../model/useBlogStudio'

type PublicBlogHomeProps = {
  posts: Post[]
  categories: string[]
  categoryFilter: string
  adBanners: AdBannerSettings[]
  onCategoryFilterChange: (category: string) => void
}

export function PublicBlogHome({
  posts,
  categories,
  categoryFilter,
  adBanners,
  onCategoryFilterChange,
}: PublicBlogHomeProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [readingProgress, setReadingProgress] = useState(0)
  const headerRef = useRef<HTMLElement>(null)
  const latestHeadRef = useRef<HTMLDivElement>(null)
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

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    return publishedPosts
      .filter((post) => categoryFilter === 'all' || post.category === categoryFilter)
      .filter((post) => {
        if (!keyword) return true

        return [post.title, post.excerpt, post.category, post.tags.join(' '), post.content]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      })
  }, [categoryFilter, publishedPosts, query])

  const selectedPost = publishedPosts.find((post) => post.id === selectedId)
  const selectedPostIndex = selectedPost ? publishedPosts.findIndex((post) => post.id === selectedPost.id) : -1

  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    loop: topPosts.length > 1,
    slides: { perView: 1, spacing: 18 },
    slideChanged(instance) {
      setCurrentSlide(instance.track.details.rel)
    },
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

  const updateReadingProgress = (event: UIEvent<HTMLElement>) => {
    const target = event.currentTarget
    const maxScroll = target.scrollHeight - target.clientHeight
    setReadingProgress(maxScroll > 0 ? Math.min(100, Math.round((target.scrollTop / maxScroll) * 100)) : 100)
  }

  // 이전/다음 버튼은 화면상 모달 밖에 두되, Dialog의 바깥 클릭 닫힘으로 처리되지 않게 제외합니다.
  const keepReaderOpenForNavControls = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    if (event.target instanceof Element && event.target.closest('.public-reader-outer-controls')) {
      event.preventDefault()
    }
  }

  const selectCategory = (category: string) => {
    onCategoryFilterChange(category)
    syncCategoryParam(category === 'all' ? '' : category)

    if (category === 'all') {
      window.requestAnimationFrame(() => {
        window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })
      })
      return
    }

    window.requestAnimationFrame(() => {
      scrollToHeaderEdge(latestHeadRef.current, headerRef.current)
    })
  }

  return (
    <div className="public-blog">
      <header ref={headerRef} className="public-header">
        <button className="public-brand" type="button" aria-label="블로그 홈" onClick={() => selectCategory('all')}>
          <span className="public-logo-blob" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>꿈을 그림</strong>
        </button>

        <nav className="public-category-nav" aria-label="공개 카테고리">
          <button
            className={categoryFilter === 'all' ? 'is-active' : ''}
            style={getCategoryStyle('전체')}
            type="button"
            onClick={() => selectCategory('all')}
          >
            전체
          </button>
          {publicCategories.map((category) => (
            <button
              className={categoryFilter === category ? 'is-active' : ''}
              key={category}
              style={getCategoryStyle(category)}
              type="button"
              onClick={() => selectCategory(category)}
            >
              {category}
            </button>
          ))}
        </nav>

        <label className="public-search public-header-search">
          <Search size={18} />
          <input value={query} placeholder="검색" onChange={(event) => setQuery(event.target.value)} />
        </label>

      </header>

      <AdStripBanners banners={adBanners} />

      <main className="public-main">
        <section className="public-hero" aria-label="전체글 TOP 10">
          <div className="public-hero-copy">
            <span className="public-kicker">
              <Trophy size={16} /> 전체글 TOP 10
            </span>
            <h1>가장 먼저 읽기 좋은 글 모음</h1>
            <p>전체 공개 글 중에서 내용 밀도, 태그, 커버 이미지를 기준으로 상위 글을 먼저 보여줍니다.</p>
            <div className="public-hero-stats">
              <span>{publishedPosts.length}개 글</span>
              <span>{publicCategories.length}개 카테고리</span>
              <span>TOP {topPosts.length}</span>
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
              <div ref={sliderRef} className="keen-slider public-slider-track">
                {topPosts.map((post, index) => (
                  <article className="keen-slider__slide public-slide" key={post.id}>
                    <button type="button" onClick={() => selectPost(post.id)}>
                      <PostImage post={post} />
                      <strong className="public-rank">TOP {index + 1}</strong>
                      <span>{post.category}</span>
                      <h2>{post.title}</h2>
                      <p>{post.excerpt || '천천히 읽기 좋은 글입니다.'}</p>
                      <em>본문 읽기</em>
                    </button>
                  </article>
                ))}
              </div>
              <div className="public-slider-controls">
                <button type="button" aria-label="이전 추천 글" disabled={topPosts.length < 2} onClick={() => slider.current?.prev()}>
                  <ChevronLeft size={18} />
                </button>
                <span className="public-slider-count">
                  <strong>{String(currentSlide + 1).padStart(2, '0')}</strong>
                  <small>/ {String(topPosts.length).padStart(2, '0')}</small>
                </span>
                <button type="button" aria-label="다음 추천 글" disabled={topPosts.length < 2} onClick={() => slider.current?.next()}>
                  <ChevronRight size={18} />
                </button>
                <div className="public-slider-dots" aria-label="TOP 10 슬라이드 위치">
                  {topPosts.map((post, index) => (
                    <button
                      className={currentSlide === index ? 'is-active' : ''}
                      key={post.id}
                      type="button"
                      aria-label={`TOP ${index + 1} 글 보기`}
                      onClick={() => slider.current?.moveToIdx(index)}
                    />
                  ))}
                </div>
              </div>
              <div className="public-top-strip" aria-label="TOP 10 빠른 선택">
                {topPosts.map((post, index) => (
                  <button
                    className={currentSlide === index ? 'is-active' : ''}
                    key={post.id}
                    type="button"
                    onClick={() => {
                      slider.current?.moveToIdx(index)
                    }}
                  >
                    <strong>{index + 1}</strong>
                    <span>{post.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="public-empty public-hero-empty">
              <strong>아직 공개된 글이 없습니다.</strong>
              <p>곧 새로운 기록이 이곳에 채워질 예정입니다.</p>
            </div>
          )}
        </section>

        <section className="public-browser" aria-label="글 탐색">
          <div ref={latestHeadRef} className="public-section-head">
            <div>
              <span>Latest Posts</span>
              <h2>최근 글</h2>
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
                  <p>{post.excerpt || '본문으로 이어지는 짧은 소개를 작성해보세요.'}</p>
                  <small>
                    <CalendarDays size={14} /> {formatDate(post.updatedAt)}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <div className="public-empty">
              <strong>조건에 맞는 공개 글이 없습니다.</strong>
              <p>검색어나 카테고리를 바꾸면 다른 글을 볼 수 있습니다.</p>
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
              <Dialog.Close className="public-reader-close" aria-label="글 닫기">
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
                  <aside className="public-reader-cover" style={getCategoryStyle(selectedPost.category)}>
                    <PostImage post={selectedPost} />
                    <div>
                      <span>{selectedPost.category}</span>
                      <strong>Dream Journal</strong>
                    </div>
                  </aside>

                  <div className="public-reader-page">
                    <div className="public-reader-meta">
                      <span>{formatDate(selectedPost.updatedAt)}</span>
                    </div>
                    <Dialog.Title className="public-reader-title">{selectedPost.title}</Dialog.Title>
                    <Dialog.Description id="reader-description" className="public-reader-description">
                      {selectedPost.excerpt}
                    </Dialog.Description>
                    <div className="public-reader-tags">
                      {selectedPost.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                    <div className="rendered-content" dangerouslySetInnerHTML={{ __html: normalizeEditorContent(selectedPost.content) }} />
                  </div>
                </div>
              </div>
            </Dialog.Content>
          )}
          {selectedPost && (
            <div className="public-reader-outer-controls" aria-label="글 이동">
              {selectedPostIndex > 0 && (
                <button className="public-reader-nav-button is-prev" type="button" aria-label="이전 글" onClick={() => moveReaderPost(-1)}>
                  <ChevronLeft size={24} />
                </button>
              )}
              {selectedPostIndex < publishedPosts.length - 1 && (
                <button className="public-reader-nav-button is-next" type="button" aria-label="다음 글" onClick={() => moveReaderPost(1)}>
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
          <strong>꿈을 그림</strong>
          <p>바쁘게 살아가는 우리들의 힐링페이퍼</p>
        </div>

        <div className="public-footer-bottom">
          <small>© {new Date().getFullYear()} 웹개발자 황상한 | 010-4105-2711</small>
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
  ['#35c5f0', '#e9f9fd'],
  ['#7cddc7', '#e9fbf6'],
  ['#ffb86b', '#fff3e4'],
  ['#b89cff', '#f2ecff'],
  ['#ff8aa5', '#fff0f4'],
  ['#8fb8ff', '#edf4ff'],
] as const

function getCategoryStyle(category: string): CSSProperties {
  const hash = Array.from(category).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const [accent, tint] = CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length]

  return {
    '--category-accent': accent,
    '--category-tint': tint,
  } as CSSProperties
}
