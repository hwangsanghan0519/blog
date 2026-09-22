import { ProductSourceBadge } from '../../../entities/post/ui/ProductSourceBadge'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, Ref, UIEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUp, Camera, Check, ChevronLeft, ChevronRight, Crown, ExternalLink, Heart, LoaderCircle, Mail, Share2, ShoppingBag, ShoppingCart, X, Zap } from 'lucide-react'
import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { countWords } from '../../../entities/post/lib/formatters'
import type { Post } from '../../../entities/post/model/types'
import { applyPublicSeo, getCategoryPath, getProductPath, getProductShareUrl, readSeoRoute } from '../../../shared/lib/seo'
import { RenderedContent } from '../../../shared/ui/RenderedContent'
import celebHouseLogoImage from '../../../assets/celeb-house-logo.svg'
import { castCelebVote, fetchCelebVotes, getOrCreateCelebVoterId } from '../api/celebVoteApi'
import type { CelebVoteRank } from '../api/celebVoteApi'
import { getInfluenceGauge } from '../lib/influenceGauge'
import { keenSliderRecovery, refreshKeenSlider } from '../lib/keenSliderRecovery'
import type { AdBannerSettings, HeroVideoSettings } from '../model/types'
import { AdStripBanners, CategoryVisual, TrendVideo } from './StorefrontMedia'
import { MobileProductSearch } from './MobileProductSearch'

type StorefrontHomeProps = {
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
  { accent: '#e9d5ff', text: '#2e1065', glow: 'rgba(196, 181, 253, 0.38)', edge: '#9b72ea' },
  { accent: '#ddd6fe', text: '#2e1065', glow: 'rgba(167, 139, 250, 0.34)', edge: '#9b72ea' },
  { accent: '#c4b5fd', text: '#2e1065', glow: 'rgba(167, 139, 250, 0.32)', edge: '#6f4a9d' },
  { accent: '#9b72ea', text: '#ffffff', glow: 'rgba(155, 114, 234, 0.3)', edge: '#171717' },
  { accent: '#8056c7', text: '#ffffff', glow: 'rgba(109, 40, 217, 0.28)', edge: '#171717' },
  { accent: '#5b21b6', text: '#ffffff', glow: 'rgba(91, 33, 182, 0.26)', edge: '#171717' },
  { accent: '#6f4a9d', text: '#ffffff', glow: 'rgba(76, 29, 149, 0.24)', edge: '#171717' },
  { accent: '#3b1674', text: '#ffffff', glow: 'rgba(59, 22, 116, 0.22)', edge: '#171717' },
  { accent: '#32145f', text: '#ffffff', glow: 'rgba(50, 20, 95, 0.2)', edge: '#171717' },
  { accent: '#3b3b42', text: '#ffffff', glow: 'rgba(59, 59, 66, 0.22)', edge: '#9b72ea' },
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

export function StorefrontHome({
  posts,
  categories,
  categoryImages,
  categoryFilter,
  heroVideo,
  adBanners,
  onCategoryFilterChange,
  onRequestPost,
}: StorefrontHomeProps) {
  const [selectedId, setSelectedId] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [readingProgress, setReadingProgress] = useState(0)
  const [isHeaderCompact, setIsHeaderCompact] = useState(false)
  const [isHeaderDocked, setIsHeaderDocked] = useState(false)
  const [hasPassedVoteSection, setHasPassedVoteSection] = useState(false)
  const [loadingDetailId, setLoadingDetailId] = useState('')
  const [shareFeedback, setShareFeedback] = useState('')
  const [isMobileBuyDockVisible, setIsMobileBuyDockVisible] = useState(false)
  const [voteRanking, setVoteRanking] = useState<CelebVoteRank[]>([])
  const [votedCategory, setVotedCategory] = useState<string | null>(null)
  const [votePendingCategory, setVotePendingCategory] = useState('')
  const [voteFeedback, setVoteFeedback] = useState('')
  const [mobileLineupImageIndex, setMobileLineupImageIndex] = useState(0)
  const headerRef = useRef<HTMLElement>(null)
  const headerSlotRef = useRef<HTMLDivElement>(null)
  const voteTriggerRef = useRef<HTMLHeadingElement>(null)
  const latestHeadRef = useRef<HTMLDivElement>(null)
  const [priceElement, setPriceElement] = useState<HTMLElement | null>(null)
  const pendingCategoryScrollRef = useRef<'top' | 'latest' | null>(null)
  const sliderPausedRef = useRef(false)
  const currentSlideRef = useRef(0)
  const headerCompactRef = useRef(false)
  const hasPassedVoteSectionRef = useRef(false)
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
  const rankedCelebs = useMemo(() => {
    const votesByCategory = new Map(voteRanking.map((item) => [item.category, item.votes]))
    return publicCategories
      .map((category, originalIndex) => ({ category, originalIndex, votes: votesByCategory.get(category) ?? 0 }))
      .sort((a, b) => b.votes - a.votes || a.originalIndex - b.originalIndex)
  }, [publicCategories, voteRanking])
  const hotInfluencerRanks = useMemo(
    () => new Map(rankedCelebs.slice(0, 3).map((item, index) => [item.category, index + 1])),
    [rankedCelebs],
  )
  const rankedCategoryNames = useMemo(
    () => rankedCelebs.map((item) => item.category),
    [rankedCelebs],
  )
  const mobileLineupVisuals = useMemo(
    () => rankedCategoryNames.flatMap((category) => {
      const image = categoryImages[category]
      return image ? [{ category, image }] : []
    }),
    [categoryImages, rankedCategoryNames],
  )
  const mobileLineupVisualKey = mobileLineupVisuals.map((item) => `${item.category}:${item.image}`).join('\u0000')
  const categoryColumns = useMemo(() => {
    const columns: string[][] = []

    for (let index = 0; index < rankedCategoryNames.length; index += CATEGORY_COLUMN_SIZE) {
      columns.push(rankedCategoryNames.slice(index, index + CATEGORY_COLUMN_SIZE))
    }

    return columns
  }, [rankedCategoryNames])
  const categoryOrderKey = rankedCategoryNames.join('\u0000')
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
      const nextSlide = instance.track.details.rel
      currentSlideRef.current = nextSlide
      setCurrentSlide(nextSlide)
    },
  }, [keenSliderRecovery])
  const [categorySliderRef, categorySlider] = useKeenSlider<HTMLDivElement>({
    dragSpeed: 0.5,
    mode: 'free',
    range: { align: true },
    rubberband: false,
    slides: { perView: 'auto', spacing: 3 },
  }, [keenSliderRecovery])

  useEffect(() => {
    applyPublicSeo({ category: categoryFilter, posts: publishedPosts, selectedPost })
  }, [categoryFilter, publishedPosts, selectedPost])

  useEffect(() => {
    if (!priceElement || !selectedId) return undefined
    const scrollRoot = priceElement.closest('.public-reader-scroll')
    if (!(scrollRoot instanceof HTMLElement)) return undefined
    const mobileMedia = window.matchMedia('(max-width: 720px)')
    let frame = 0
    const syncVisibility = () => {
      frame = 0
      const priceRect = priceElement.getBoundingClientRect()
      const rootRect = scrollRoot.getBoundingClientRect()
      const viewportTop = window.visualViewport?.offsetTop ?? 0
      const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight)
      const visibleTop = Math.max(rootRect.top, viewportTop)
      const visibleBottom = Math.min(rootRect.bottom, viewportBottom)
      const priceVisible = priceRect.bottom > visibleTop && priceRect.top < visibleBottom
      setIsMobileBuyDockVisible(mobileMedia.matches && priceRect.height > 0 && !priceVisible)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(syncVisibility)
    }
    // The callback ref runs when Radix's portal actually mounts, not before it exists.
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(schedule, { root: scrollRoot, threshold: [0, 1] })
    observer?.observe(priceElement)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resizeObserver?.observe(scrollRoot)
    resizeObserver?.observe(priceElement)
    scrollRoot.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    window.visualViewport?.addEventListener('resize', schedule, { passive: true })
    window.visualViewport?.addEventListener('scroll', schedule, { passive: true })
    const removeMobileMediaListener = listenForMediaQueryChange(mobileMedia, schedule)
    schedule()
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      resizeObserver?.disconnect()
      scrollRoot.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
      removeMobileMediaListener()
    }
  }, [priceElement, selectedId])

  useEffect(() => {
    const controller = new AbortController()
    const voterId = getOrCreateCelebVoterId()

    void fetchCelebVotes(voterId, controller.signal)
      .then((snapshot) => {
        setVoteRanking(snapshot.ranking)
        setVotedCategory(snapshot.votedCategory)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setVoteFeedback('현재 순위를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (topPosts.length < 2) return undefined

    const timer = window.setInterval(() => {
      if (!selectedId && !sliderPausedRef.current && !document.hidden && slider.current?.container.dataset.sliderReady === 'true' && !slider.current.animator.active) {
        slider.current?.next()
      }
    }, 4500)

    return () => window.clearInterval(timer)
  }, [selectedId, slider, topPosts.length])

  useEffect(() => {
    sliderPausedRef.current = Boolean(selectedId)
    if (selectedId) {
      slider.current?.animator.stop()
      return undefined
    }
    const frame = window.requestAnimationFrame(() => {
      if (slider.current) refreshKeenSlider(slider.current, currentSlideRef.current)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedId, slider])

  useEffect(() => {
    const updateCategorySlider = () => {
      if (categorySlider.current) refreshKeenSlider(categorySlider.current)
    }
    const frame = window.requestAnimationFrame(() => {
      updateCategorySlider()
      categorySlider.current?.moveToIdx(0, true, { duration: 0 })
    })
    window.addEventListener('resize', updateCategorySlider)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateCategorySlider)
    }
  }, [categoryOrderKey, categorySlider, isHeaderCompact])

  useEffect(() => {
    const mobileMedia = window.matchMedia('(max-width: 720px)')
    let timer = 0

    const syncLineupAnimation = () => {
      window.clearInterval(timer)
      setMobileLineupImageIndex(0)
      if (!mobileMedia.matches || mobileLineupVisuals.length < 2) return

      timer = window.setInterval(() => {
        setMobileLineupImageIndex((current) => (current + 1) % mobileLineupVisuals.length)
      }, 1200)
    }

    syncLineupAnimation()
    const removeMobileMediaListener = listenForMediaQueryChange(mobileMedia, syncLineupAnimation)

    return () => {
      window.clearInterval(timer)
      removeMobileMediaListener()
    }
  }, [mobileLineupVisualKey, mobileLineupVisuals.length])

  useEffect(() => {
    let previousScrollY = window.scrollY
    let downwardDistance = 0

    const applyHeaderMode = (compact: boolean) => {
      if (headerCompactRef.current === compact) return

      headerCompactRef.current = compact
      setIsHeaderCompact(compact)
    }

    const applyVoteSectionPassed = (passed: boolean) => {
      if (hasPassedVoteSectionRef.current === passed) return

      hasPassedVoteSectionRef.current = passed
      setHasPassedVoteSection(passed)
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - previousScrollY
      const isMobileViewport = window.matchMedia('(max-width: 720px)').matches
      const visualViewportOffset = Math.max(0, window.visualViewport?.offsetTop ?? 0)
      const headerStart = headerSlotRef.current?.offsetTop ?? 0
      const shouldDockHeader = currentScrollY >= headerStart
      const isAtTop = currentScrollY <= 12

      headerRef.current?.style.setProperty('--mobile-viewport-offset', `${visualViewportOffset}px`)

      const voteTriggerTop = voteTriggerRef.current?.getBoundingClientRect().top
      const dockedHeaderBottom = headerRef.current?.getBoundingClientRect().bottom ?? 0
      const pageScrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const pageScrollProgress = Math.min(1, Math.max(0, currentScrollY / pageScrollRange))
      const scrollCharm = pageScrollProgress >= 0.9
        ? 'necklace'
        : pageScrollProgress >= 0.6
          ? 'lipstick'
          : pageScrollProgress >= 0.3
            ? 'shirt'
            : 'dot'

      headerRef.current?.style.setProperty('--mobile-scroll-progress', String(pageScrollProgress))
      if (headerRef.current) headerRef.current.dataset.scrollCharm = scrollCharm

      setIsHeaderDocked(shouldDockHeader)
      applyVoteSectionPassed(
        shouldDockHeader
        && voteTriggerTop !== undefined
        && voteTriggerTop <= dockedHeaderBottom + 1,
      )

      if (isMobileViewport) {
        downwardDistance = 0
        applyHeaderMode(false)
      } else if (!shouldDockHeader || isAtTop) {
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
    window.addEventListener('resize', handleScroll, { passive: true })
    window.visualViewport?.addEventListener('scroll', handleScroll, { passive: true })
    window.visualViewport?.addEventListener('resize', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      window.visualViewport?.removeEventListener('scroll', handleScroll)
      window.visualViewport?.removeEventListener('resize', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (categoryFilter === 'all') return undefined

    const categoryIndex = rankedCategoryNames.indexOf(categoryFilter)
    if (categoryIndex < 0) return undefined

    const timer = window.setTimeout(() => {
      categorySlider.current?.moveToIdx(Math.floor(categoryIndex / CATEGORY_COLUMN_SIZE), true)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [categoryFilter, categorySlider, rankedCategoryNames])

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
    setIsMobileBuyDockVisible(false)
    requestPostDetail(post.id)
    setReadingProgress(0)
    syncPostParam(post.slug || post.id)
  }

  const closeReader = () => {
    setSelectedId('')
    setIsMobileBuyDockVisible(false)
    setReadingProgress(0)
    syncPostParam('', categoryFilter === 'all' ? '' : categoryFilter)
  }

  const sharePost = async (post: Post) => {
    const url = getProductShareUrl(post.slug || post.id)
    const shareData = {
      title: `${post.title} | ${post.category} 핫템 - 셀럽하우스`,
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

  const voteForCeleb = async (category: string) => {
    if (votedCategory || votePendingCategory) return

    setVotePendingCategory(category)
    setVoteFeedback('')
    try {
      const result = await castCelebVote(category, getOrCreateCelebVoterId())
      setVoteRanking(result.ranking)
      setVotedCategory(result.votedCategory)
      setVoteFeedback(result.accepted
        ? `${category}에게 오늘의 한 표를 보냈어요!`
        : `오늘은 이미 ${result.votedCategory ?? '한 셀럽'}에게 투표했어요.`)
    } catch (error) {
      setVoteFeedback(error instanceof Error ? error.message : '투표를 저장하지 못했습니다.')
    } finally {
      setVotePendingCategory('')
    }
  }

  const browseReaderCategory = (category: string) => {
    setSelectedId('')
    setReadingProgress(0)
    selectCategory(category)
  }

  return (
    <div className="public-blog">
      <AdStripBanners banners={adBanners} />

      <section className="public-mobile-brand-strip" aria-label="셀럽하우스 브랜드 메시지">
        <span className="public-mobile-banner-aurora" aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="public-mobile-banner-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {mobileLineupVisuals.length > 0 && (
          <span className="public-mobile-influencer-fade" aria-hidden="true">
            {mobileLineupVisuals.map((item, index) => (
              <img
                className={index === mobileLineupImageIndex ? 'is-active' : ''}
                decoding="async"
                key={item.category}
                src={item.image}
                alt=""
              />
            ))}
          </span>
        )}
        <span className="public-mobile-viole-logo" aria-hidden="true">
          <img src={celebHouseLogoImage} alt="" />
        </span>
        <div>
          <span>CELEB HOUSE CURATED</span>
          <strong><em>나의 최애가</em><b>선택한 아이템</b></strong>
        </div>
        <small>타게팅 인플루언서 큐레이션</small>
        <span className="public-mobile-banner-signal" aria-hidden="true"><i /></span>
      </section>

      <div
        ref={headerSlotRef}
        className={`public-header-slot ${isHeaderDocked && isHeaderCompact ? 'is-scroll-compact' : ''}`}
      >
      <header
        ref={headerRef}
        className={`public-header ${isHeaderDocked ? 'is-docked' : ''} ${isHeaderCompact ? 'is-scroll-compact' : ''}`}
      >
        <div className="public-mobile-lineup-label" aria-hidden="true">
          <span>LINE <em>UP</em></span>
        </div>

        <button className="public-brand" type="button" aria-label="전체 상품 보기" onClick={() => selectCategory('all')}>
          <span className="public-viole-logo" aria-hidden="true">
            <img src={celebHouseLogoImage} alt="" />
          </span>
          <span className="public-brand-message" aria-hidden="true">
            <span className="public-brand-kicker">  어느 별에서 왔니?  </span>
            <span className="public-brand-title">
              <em>나의 최애가</em>
              <b>선택한 아이템</b>
            </span>
            <span className="public-brand-caption">국내 최초 인풀루언서 컨텍팅</span>
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
                {column.map((category) => {
                  const isActiveCategory = categoryFilter === category
                  const mobileInfluencerRank = hotInfluencerRanks.get(category)
                  const hotInfluencerRank = hasPassedVoteSection ? mobileInfluencerRank : undefined

                  return (
                    <button
                      aria-label={`${category} 카테고리`}
                      aria-pressed={isActiveCategory}
                      className={`public-category-slide ${isActiveCategory ? 'is-active' : ''} ${mobileInfluencerRank ? `is-mobile-top is-mobile-top-${mobileInfluencerRank}` : ''} ${hotInfluencerRank ? `is-hot-influencer is-hot-${hotInfluencerRank}` : ''}`}
                      data-category={category}
                      key={category}
                      style={getCategoryStyle(category)}
                      type="button"
                      onClick={() => selectCategory(category)}
                    >
                      <CategoryVisual image={categoryImages[category]} label={category} />
                      {isActiveCategory ? (
                        <span className="public-category-active-badge" aria-hidden="true">
                          <Check size={10} strokeWidth={3.5} />
                        </span>
                      ) : null}
                      {mobileInfluencerRank ? (
                        <i className="public-category-mobile-rank">#{mobileInfluencerRank}</i>
                      ) : null}
                      {hotInfluencerRank ? (
                        <em className="public-category-hot">HOT INFLUENCER</em>
                      ) : null}
                      <span>CELEB</span>
                      <strong>{category}</strong>
                      <small>{categoryCounts[category] ?? 0}</small>
                    </button>
                  )
                })}
              </div>
            ))}
            </div>
          </div>
        </nav>

        <span className="public-mobile-scroll-progress" aria-hidden="true">
          <i className="public-scroll-charm is-dot" />
          <svg className="public-scroll-charm is-shirt" viewBox="0 0 24 24">
            <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z" />
          </svg>
          <svg className="public-scroll-charm is-lipstick" viewBox="0 0 24 24">
            <path d="M9 9.2V5.7c0-.8.4-1.5 1.1-1.9l3.4-1.7c.7-.3 1.5.2 1.5 1v6.1" />
            <path d="M8 9h8v5H8zM7 14h10v7H7z" />
            <path d="M10.5 5.2 15 3" />
          </svg>
          <svg className="public-scroll-charm is-necklace" viewBox="0 0 24 24">
            <path d="M4 4c.5 6.1 3.3 9.2 8 9.2S19.5 10.1 20 4" />
            <path d="m12 12.5-3 3.6 3 4.4 3-4.4-3-3.6Z" />
          </svg>
        </span>

      </header>
      </div>

      <TrendVideo settings={heroVideo} />

      <main className="public-main">
        <section className="public-hero public-best-v2" aria-label="바이럴 베스트 TOP 10">
          <div className="public-hero-copy">
            <span className="public-kicker">
              인플루언서 랭킹과 구매 포인트를 합산한
              <br />
              지금 가장 바이럴한 아이템 TOP 10
            </span>
            <h1>
              <span>VIRAL</span>
              <em>BEST</em>
            </h1>
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
                    <div className="public-best-v2-card" onClick={() => selectPost(post.id)}>
                      <div className="public-best-v2-media" data-rank={String(index + 1).padStart(2, '0')}>
                        <PostImage post={post} priority={index === 0} />
                        <strong className="public-rank">
                          <small>TOP</small>
                          <b>{String(index + 1).padStart(2, '0')}</b>
                        </strong>
                        <div className="public-best-v2-category-live">
                          <ProductSourceBadge post={post} />
                          <span aria-hidden="true"><i /></span>
                          <strong>{post.category}</strong>
                        </div>
                      </div>
                      <div className="public-best-v2-content">
                        <div className="public-best-v2-mobile-meta">
                          <ProductSourceBadge post={post} />
                          <span className="public-best-v2-mobile-category">{post.category}</span>
                        </div>
                        <h2>{post.title}</h2>
                        <p>{post.excerpt || '지금 비교하기 좋은 상품입니다.'}</p>
                        <BestSliderPrice post={post} />
                        <div className="public-best-v2-buy">
                          <BestSliderLowestLink post={post} />
                          <em>
                            <button className="public-best-v2-detail-button" type="button" aria-label={`${post.title} 상품 상세보기`}>
                              상품 상세보기 <ExternalLink size={17} />
                            </button>
                          </em>
                        </div>
                      </div>
                    </div>
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
            </div>
          ) : (
            <div className="public-empty public-hero-empty">
              <strong>아직 공개된 상품이 없습니다.</strong>
              <p>곧 강한 가격의 딜이 이곳에 채워질 예정입니다.</p>
            </div>
          )}
        </section>

        {rankedCelebs.length > 0 && (
          <div className="celeb-vote-stage">
          <section className="celeb-vote" aria-labelledby="celeb-vote-title">
            <div className="celeb-vote-heading">
              <div>
                <span className="celeb-vote-kicker"><i /> LIVE</span>
                <h2 ref={voteTriggerRef} id="celeb-vote-title">
                  <span>여러분의</span>
                  <span>최애에게</span>
                  <em>투표하세요</em>
                </h2>
                <p>인플루언서 게이지가 올라가요</p>
              </div>
              <div className="celeb-vote-total" aria-label="매일 한 번 참여할 수 있는 투표">
                <span className="celeb-vote-total-icon" aria-hidden="true">
                  <Heart size={28} strokeWidth={2.4} />
                  <b>1</b>
                </span>
                <span className="celeb-vote-total-copy">
                  <small>DAILY VOTE</small>
                  <strong>매일매일 한 번의 투표 기회</strong>
                </span>
              </div>
            </div>

            <ol className="celeb-vote-ranking">
              {rankedCelebs.map((item, index) => {
                const isVoted = votedCategory === item.category
                const isPending = votePendingCategory === item.category
                const influenceGauge = getInfluenceGauge(item.votes)

                return (
                  <li className={`${index < 3 ? `is-top is-top-${index + 1} is-debut-zone` : ''} ${isVoted ? 'is-voted' : ''}`} key={item.category}>
                    <span className="celeb-vote-rank">{String(index + 1).padStart(2, '0')}</span>
                    <a
                      className="celeb-vote-pick-link"
                      href={getCategoryPath(item.category)}
                      aria-label={`${item.category} PICK 상품 보기`}
                      onClick={(event) => {
                        event.preventDefault()
                        selectCategory(item.category)
                      }}
                    >
                      <div className="celeb-vote-avatar">
                        <CategoryVisual image={categoryImages[item.category]} label={item.category} />
                        {index === 0 && <Crown size={16} aria-hidden="true" />}
                      </div>
                      <div className="celeb-vote-info">
                        <div>
                          <strong><span>{item.category}</span></strong>
                          <span className="celeb-vote-infl" aria-label={`인플 게이지 ${influenceGauge}%`}>
                            <b>INFL</b>
                            <em>{influenceGauge}%</em>
                          </span>
                        </div>
                        <span className="celeb-vote-meter" aria-label={`인플 게이지 ${influenceGauge}%`} role="meter" aria-valuemin={0} aria-valuemax={99} aria-valuenow={influenceGauge}>
                          <i style={{ width: `${Math.max(1, influenceGauge)}%` }} />
                        </span>
                      </div>
                    </a>
                    <button
                      type="button"
                      disabled={Boolean(votedCategory) || Boolean(votePendingCategory)}
                      aria-label={`${item.category}에게 투표`}
                      onClick={() => void voteForCeleb(item.category)}
                    >
                      {isPending ? <LoaderCircle className="is-spinning" size={17} /> : isVoted ? <Check size={17} /> : <Heart size={17} />}
                      <span>{isVoted ? 'MY PICK' : votedCategory ? 'CLOSED' : 'PICK'}</span>
                    </button>
                  </li>
                )
              })}
            </ol>

            <div className={`celeb-vote-notice ${votedCategory ? 'is-complete' : ''}`} aria-live="polite">
              <span><i /> {votedCategory ? `오늘의 원픽 · ${votedCategory}` : '인플루언서 게이지는 응원이 쌓일수록 상승합니다 · RESET 00:00'}</span>
              {voteFeedback && <strong>{voteFeedback}</strong>}
            </div>
          </section>
          </div>
        )}

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
                <article
                  className={`public-post-card ${categoryFilter === 'all' ? 'is-all-pouch' : 'is-category-pouch'} ${selectedId === post.id ? 'is-active' : ''}`}
                  key={post.id}
                  style={getCategoryStyle(post.category)}
                >
                  <a
                    className="public-post-card-link"
                    aria-label={`${post.title} 상품 상세 보기`}
                    href={getProductPath(post.slug || post.id)}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      selectPost(post.id)
                    }}
                  >
                    <div className="public-post-media">
                      <PostImage post={post} />
                    </div>
                    <PouchCardOverlay post={post} showCategory={categoryFilter === 'all'} />
                  </a>
                  <ProductSourceBadge post={post} />
                </article>
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
                          <ProductSourceBadge post={selectedPost} />
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
                        <ProductLinkPanel priceRef={setPriceElement} post={selectedPost} />
                        <div className="product-detail-assurance" aria-label="제휴몰 이용 안내">
                          <span>등록된 제휴몰 가격 비교</span>
                          <span>등록된 제휴몰로 바로 이동</span>
                          <span>보러가기를 누르면 제휴몰이 새 창으로 열립니다</span>
                        </div>
                      </div>
                    </section>
                    <section className="product-detail-body" aria-label="상품 상세 정보">
                      <div className="product-detail-side">
                        <header>
                          <span>PRODUCT STORY</span>
                          <h2>상품 상세</h2>
                          <p>고민하는 셀하들을 위해 핵심만 뽑뽑</p>
                        </header>
                        <ProductDetailSideFooter
                          post={selectedPost}
                          onCategorySelect={() => browseReaderCategory(selectedPost.category)}
                        />
                      </div>
                      {loadingDetailId === selectedPost.id ? (
                        <div className="product-detail-loading" aria-live="polite">상품 상세를 준비하고 있습니다.</div>
                      ) : (
                        <ProductDetailContent key={selectedPost.id} post={selectedPost} />
                      )}
                    </section>
                  </div>
                </div>
              </div>
              {isMobileBuyDockVisible && <MobileProductBuyDock post={selectedPost} />}
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
            <img src={celebHouseLogoImage} alt="셀럽하우스" />
          </button>

          <div className="public-footer-v3-message">
            <span>CURATED / SEOUL</span>
            <strong>PICKED BY CELEB HOUSE.</strong>
          </div>

          <div className="public-footer-v3-actions">
            <button type="button" aria-label="페이지 맨 위로 이동" onClick={() => window.scrollTo({ left: 0, top: 0, behavior: 'smooth' })}>
              <ArrowUp size={19} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="public-footer-v3-bottom">
          <small>© {new Date().getFullYear()} CELEB HOUSE</small>
          <span>SEOUL · KR</span>
        </div>
      </footer>

      <MobileProductSearch posts={publishedPosts} onSelect={selectPost} />
      <div className="public-quick-actions" aria-label="빠른 기능">
        <a href="mailto:nmc2711@naver.com" aria-label="제휴 문의 이메일 보내기">
          <Mail size={21} />
          <span>제휴 문의</span>
        </a>
      </div>
    </div>
  )
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
  }, [keenSliderRecovery])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveIndex(0)
      if (gallery.current) refreshKeenSlider(gallery.current, 0)
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
        <span className="product-gallery-pick">CELEB HOUSE PICK</span>
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
        <span>CELEB HOUSE PICK</span>
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
  const [activeImage, setActiveImage] = useState<number | null>(null)
  const imageTriggerRef = useRef<HTMLButtonElement | null>(null)
  const frames = Array.from({ length: 4 }, (_, index) => ({
    description: post.detailDescriptions[index]?.trim() ?? '',
    image: post.detailImages[index] ?? '',
  }))
  const hasCompleteFourCut = frames.every((frame) => frame.image && frame.description)

  if (!hasCompleteFourCut) return <RenderedContent content={post.content} />

  return (
    <Dialog.Root open={activeImage !== null} onOpenChange={(open) => { if (!open) setActiveImage(null) }}>
    <section className="viole-four-cut" aria-label="셀럽하우스 네컷 상품 상세">
      <header>
        <strong><Camera aria-hidden="true" />셀럽네컷</strong>
      </header>
      <ol>
        {frames.map((frame, index) => (
          <li data-four-cut-index={index} key={`${frame.image.slice(0, 48)}-${index}`}>
            <figure>
              <Dialog.Trigger asChild>
                <button className="four-cut-image-trigger" type="button" aria-label={`${index + 1}번 셀럽네컷 원본 이미지 보기`} onClick={(event) => { imageTriggerRef.current = event.currentTarget; setActiveImage(index) }}>
                  <img src={frame.image} alt={`${post.title} 상세 ${index + 1}`} decoding="async" loading="lazy" />
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              </Dialog.Trigger>
            </figure>
            <div>
              <small>CUT {String(index + 1).padStart(2, '0')}</small>
              <p>{frame.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <footer>
        <span>CELEB HOUSE FOUR CUT</span>
        <strong>셀럽네컷</strong>
      </footer>
    </section>
    <Dialog.Portal>
      <Dialog.Overlay className="four-cut-lightbox-dim" />
      <Dialog.Content
        className="four-cut-lightbox"
        onCloseAutoFocus={(event) => { event.preventDefault(); imageTriggerRef.current?.focus({ preventScroll: true }) }}
        onClick={(event) => { if (event.target === event.currentTarget) setActiveImage(null) }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); setActiveImage((index) => Math.max(0, (index ?? 0) - 1)) }
          if (event.key === 'ArrowRight') { event.preventDefault(); setActiveImage((index) => Math.min(3, (index ?? 0) + 1)) }
        }}
      >
        <Dialog.Title className="four-cut-lightbox-title">셀럽네컷 · {(activeImage ?? 0) + 1} / 4</Dialog.Title>
        <Dialog.Close className="four-cut-lightbox-close" aria-label="원본 이미지 닫기"><X size={24} /></Dialog.Close>
        {activeImage !== null && <img className="four-cut-lightbox-image" src={frames[activeImage].image} alt={`${post.title} 상세 ${activeImage + 1} 원본`} />}
        <Dialog.Description className="four-cut-lightbox-description">{activeImage !== null ? frames[activeImage].description : ''}</Dialog.Description>
        <button className="four-cut-lightbox-prev" type="button" aria-label="이전 원본 이미지" disabled={activeImage === 0} onClick={() => setActiveImage((index) => Math.max(0, (index ?? 0) - 1))}><ChevronLeft /></button>
        <button className="four-cut-lightbox-next" type="button" aria-label="다음 원본 이미지" disabled={activeImage === 3} onClick={() => setActiveImage((index) => Math.min(3, (index ?? 0) + 1))}><ChevronRight /></button>
      </Dialog.Content>
    </Dialog.Portal>
    </Dialog.Root>
  )
}

function PouchCardOverlay({ post, showCategory }: { post: Post; showCategory: boolean }) {
  const bestLink = getBestProductLink(post)
  const price = bestLink?.price.trim() || '가격 준비중'

  return (
    <div className={`public-pouch-overlay ${showCategory ? 'is-all' : 'is-category'}`}>
      {showCategory && <span>{post.category}</span>}
      <strong>
        {showCategory && <em className="public-pouch-mobile-title" aria-hidden="true">{post.title}</em>}
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
      <Zap size={18} /> 보러가기
    </strong>
  )
}

function ProductLinkPanel({ post, priceRef }: { post: Post; priceRef?: Ref<HTMLElement> }) {
  const links = post.productLinks.filter((link) => link.href.trim())

  if (!links.length) {
    return (
      <section className="product-buy-panel is-empty">
        <div>
          <span>
            <ShoppingBag size={16} /> 제휴 링크
          </span>
          <strong>등록된 제휴몰이 없습니다.</strong>
        </div>
      </section>
    )
  }

  const primaryLink = getBestProductLink(post) ?? links[0]
  const comparisonLinks = links.filter((link) => link.id !== primaryLink.id)

  return (
    <section className="product-buy-panel" aria-label="제휴몰 비교">
      <div className="product-buy-primary">
        <div className="product-buy-primary-head">
          <span>
            <Zap size={16} /> 지금 최저가
          </span>
          {primaryLink.mall.trim() && <small>{primaryLink.mall}</small>}
          <strong ref={priceRef}>{primaryLink.price || '가격 확인'}</strong>
        </div>
        <a href={primaryLink.href} target="_blank" rel="noreferrer sponsored">
          <ShoppingBag size={18} /> 보러가기 <ExternalLink size={16} />
        </a>
      </div>
      {comparisonLinks.length > 0 && (
        <div className="product-buy-compare">
          <div className="product-buy-compare-head">
            <strong>다른 제휴몰 비교</strong>
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
                <small aria-label={`${link.mall || '쇼핑몰'} 보러가기`}>
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

function MobileProductBuyDock({ post }: { post: Post }) {
  const primaryLink = getBestProductLink(post)

  if (!primaryLink?.href.trim()) return null

  return (
    <aside className="mobile-product-buy-dock" aria-label="제휴몰 보러가기">
      <div>
        <small>지금 최저가</small>
        <strong>{primaryLink.price || '가격 확인'}</strong>
      </div>
      <a href={primaryLink.href} target="_blank" rel="noreferrer sponsored">
        <ShoppingBag aria-hidden="true" />
        <span>보러가기</span>
        <ChevronRight aria-hidden="true" />
      </a>
    </aside>
  )
}

function ProductDetailSideFooter({ post, onCategorySelect }: { post: Post; onCategorySelect: () => void }) {
  const primaryLink = getBestProductLink(post)

  return (
    <aside className="product-detail-side-footer" aria-label="상품 상세 푸터">
      <button className="product-detail-side-footer-category" type="button" onClick={onCategorySelect}>
        <span>{post.category || 'CELEB HOUSE PICK'}</span>
      </button>
      <div className="product-detail-side-footer-copy">
        <strong>{post.title}</strong>
        <p>{post.excerpt || '셀럽하우스가 고른 상품의 핵심 정보를 네 컷으로 확인하세요.'}</p>
      </div>
      <div className="product-detail-side-footer-price">
        <strong>{primaryLink?.price || '가격 확인'}</strong>
      </div>
      {primaryLink?.href.trim() && (
        <a href={primaryLink.href} target="_blank" rel="noreferrer sponsored">
          <span>보러가기</span>
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

function listenForMediaQueryChange(query: MediaQueryList, listener: () => void) {
  // Older iOS Safari and embedded Android webviews only expose the legacy API.
  // Throwing inside an effect here prevents the rest of the mobile setup from
  // completing, including the lineup timer.
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }

  query.addListener(listener)
  return () => query.removeListener(listener)
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
  ['#9b72ea', '#fff1f2'],
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
