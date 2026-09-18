import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createEmptyPost, starterPosts } from '../../../entities/post/model/factory'
import type { Post, PostStatus, PostStatusFilter, ProductLink } from '../../../entities/post/model/types'
import { countWords } from '../../../entities/post/lib/formatters'
import { createId } from '../../../shared/lib/id'
import { downloadJson, imageFileToOptimizedDataUrl } from '../../../shared/lib/file'
import { loadJson, saveJson } from '../../../shared/lib/storage'
import type { ViewMode } from './types'

const STORAGE_KEY = 'solo-commerce-blog-posts'
const SETTINGS_KEY = 'solo-commerce-blog-settings'
const CATEGORIES_KEY = 'solo-commerce-blog-categories'
const CATEGORY_IMAGES_KEY = 'solo-commerce-blog-category-images'
const PUBLIC_STORAGE_KEY = 'solo-commerce-blog-public-summary-v2'
const PUBLIC_SETTINGS_KEY = 'solo-commerce-blog-public-settings-v2'
const PUBLIC_CATEGORY_IMAGES_KEY = 'solo-commerce-blog-public-category-images-v2'
const OWNER_PASSWORD_KEY = 'solo-commerce-blog-owner-password'
const ADMIN_TOKEN_KEY = 'solo-commerce-blog-admin-token'
const CLOUD_UPDATE_CHANNEL = 'solo-commerce-blog-cloud-update'
const CLOUD_DATA_ENDPOINT = '/.netlify/functions/blog-data'
const PRODUCTION_CLOUD_DATA_ENDPOINT = 'https://unique-rabanadas-3f0f48.netlify.app/.netlify/functions/blog-data'
const UNCATEGORIZED = '분류 없음'

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

type BlogSettings = {
  darkMode: boolean
  adBanners: AdBannerSettings[]
  heroVideo: HeroVideoSettings
}

type CloudBlogData = {
  adBanners?: AdBannerSettings[]
  categories?: string[]
  categoryImages?: Record<string, string>
  heroVideo?: Partial<HeroVideoSettings>
  posts?: Post[]
  savedAt?: string
}

type CloudBlogSnapshot = {
  adBanners: AdBannerSettings[]
  categories: string[]
  categoryImages: Record<string, string>
  heroVideo: HeroVideoSettings
  posts: Post[]
}

type CloudBlogPatch = Partial<Omit<CloudBlogSnapshot, 'posts'>> & {
  deletedPostIds?: string[]
  postChanges?: Array<{ id: string; patch: Partial<Post> }>
}

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

const DEFAULT_AD_BANNERS = [createDefaultAdBanner(0), createDefaultAdBanner(1)]

const DEFAULT_HERO_VIDEO: HeroVideoSettings = {
  enabled: false,
  visibilityConfigured: false,
  youtubeUrl: '',
  eyebrow: 'NOW PLAYING',
  title: 'SSEN VIDEO PICK',
  stickerImage: '',
  stickerHref: '',
}

const DEFAULT_SETTINGS: BlogSettings = {
  darkMode: false,
  adBanners: DEFAULT_AD_BANNERS,
  heroVideo: DEFAULT_HERO_VIDEO,
}

export function useBlogStudio() {
  const hostedRuntime = isHostedRuntime()
  const publicSummaryMode = hostedRuntime && !isSecretAdminRuntime()
  const lightweightCacheMode = hostedRuntime || isSecretAdminRuntime()
  const initialSettings = readSettings(lightweightCacheMode ? PUBLIC_SETTINGS_KEY : SETTINGS_KEY)
  const [posts, setPosts] = useState<Post[]>(() =>
    normalizePosts(loadJson<unknown>(lightweightCacheMode ? PUBLIC_STORAGE_KEY : STORAGE_KEY, lightweightCacheMode ? [] : starterPosts), uniqueCategories(starterPosts)),
  )
  const [categories, setCategories] = useState<string[]>(() =>
    normalizeCategories(loadJson<unknown>(CATEGORIES_KEY, uniqueCategories(posts))),
  )
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>(() =>
    normalizeCategoryImages(loadJson<unknown>(lightweightCacheMode ? PUBLIC_CATEGORY_IMAGES_KEY : CATEGORY_IMAGES_KEY, {})),
  )
  const [activeId, setActiveId] = useState(posts[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PostStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [view, setView] = useState<ViewMode>('editor')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(initialSettings.darkMode)
  const [adBanners, setAdBanners] = useState<AdBannerSettings[]>(initialSettings.adBanners)
  const [heroVideo, setHeroVideo] = useState<HeroVideoSettings>(initialSettings.heroVideo)
  const [ownerMode, setOwnerMode] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudSynced, setCloudSynced] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const detailedPostsRef = useRef(new Map<string, Post>())
  const cloudSnapshotRef = useRef<CloudBlogSnapshot | null>(null)

  const activePost = posts.find((post) => post.id === activeId) ?? posts[0]

  const syncCloudData = useCallback(async (signal?: AbortSignal) => {
    const endpoint = getCloudDataEndpoint()
    const response = await fetch(publicSummaryMode ? `${endpoint}?view=summary` : endpoint, {
      cache: publicSummaryMode ? 'no-store' : 'default',
      headers: { accept: 'application/json' },
      signal,
    })
    if (!response.ok) return false

    const data = (await response.json()) as CloudBlogData
    if (signal?.aborted) return false

    const cloudCategories = normalizeCategories(data.categories)
    const cloudPosts = normalizePosts(data.posts, cloudCategories).map(
      (post) => detailedPostsRef.current.get(post.id) ?? post,
    )
    const nextCategories = normalizeCategories([...cloudCategories, ...uniqueCategories(cloudPosts)])
    const nextCategoryImages = normalizeCategoryImages(data.categoryImages)
    const nextAdBanners = data.adBanners?.length ? normalizeAdBanners(data.adBanners) : DEFAULT_AD_BANNERS
    const nextHeroVideo = normalizeHeroVideo(data.heroVideo)

    if (!publicSummaryMode) {
      cloudSnapshotRef.current = {
        adBanners: nextAdBanners,
        categories: nextCategories,
        categoryImages: nextCategoryImages,
        heroVideo: nextHeroVideo,
        posts: cloudPosts,
      }
    }

    setPosts(cloudPosts)
    setCategories(nextCategories)
    setCategoryImages(nextCategoryImages)
    setAdBanners(nextAdBanners)
    setHeroVideo(nextHeroVideo)
    setActiveId((current) => (cloudPosts.some((post) => post.id === current) ? current : cloudPosts[0]?.id ?? ''))
    setCloudSynced(true)
    return true
  }, [publicSummaryMode])

  const loadPostDetail = useCallback(async (postId: string) => {
    if (!publicSummaryMode || detailedPostsRef.current.has(postId)) return

    try {
      const endpoint = getCloudDataEndpoint()
      const response = await fetch(`${endpoint}?post=${encodeURIComponent(postId)}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) return

      const [detailedPost] = normalizePosts([await response.json()])
      if (!detailedPost) return

      detailedPostsRef.current.set(detailedPost.id, detailedPost)
      setPosts((current) => current.map((post) => (post.id === detailedPost.id ? detailedPost : post)))
    } catch {
      // 목록은 계속 사용할 수 있도록 상세 데이터 요청 실패만 조용히 건너뜁니다.
    }
  }, [publicSummaryMode])

  // localStorage는 서버 저장 실패나 로컬 개발 상황을 위한 임시 캐시로만 사용합니다.
  // 배포 환경에서는 무거운 본문/인라인 이미지를 제외한 목록 캐시만 저장해 입력 지연을 막습니다.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(lightweightCacheMode ? PUBLIC_STORAGE_KEY : STORAGE_KEY, lightweightCacheMode ? createLightweightPostCache(posts) : posts)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [lightweightCacheMode, posts])

  useEffect(() => {
    const timer = window.setTimeout(() => saveJson(CATEGORIES_KEY, categories), 500)
    return () => window.clearTimeout(timer)
  }, [categories])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(lightweightCacheMode ? PUBLIC_CATEGORY_IMAGES_KEY : CATEGORY_IMAGES_KEY, lightweightCacheMode ? stripEmbeddedImages(categoryImages) : categoryImages)
    }, 900)

    return () => window.clearTimeout(timer)
  }, [categoryImages, lightweightCacheMode])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(lightweightCacheMode ? PUBLIC_SETTINGS_KEY : SETTINGS_KEY, {
        darkMode,
        adBanners: lightweightCacheMode ? createLightweightBannerCache(adBanners) : adBanners,
        heroVideo: lightweightCacheMode ? createLightweightHeroVideoCache(heroVideo) : heroVideo,
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [adBanners, darkMode, heroVideo, lightweightCacheMode])

  useEffect(() => {
    const controller = new AbortController()

    const loadCloudData = async () => {
      try {
        const synced = await syncCloudData(controller.signal)
        if (!synced && hostedRuntime) {
          setPosts([])
          setCategories([])
          setCategoryImages({})
          setAdBanners(DEFAULT_AD_BANNERS)
          setHeroVideo(DEFAULT_HERO_VIDEO)
          setActiveId('')
        }
      } catch {
        // 로컬 개발이나 서버 연결 실패 상황에서는 기존 localStorage 캐시를 그대로 사용합니다.
        if (hostedRuntime) {
          setPosts([])
          setCategories([])
          setCategoryImages({})
          setAdBanners(DEFAULT_AD_BANNERS)
          setHeroVideo(DEFAULT_HERO_VIDEO)
          setActiveId('')
        }
      } finally {
        if (!controller.signal.aborted) setCloudReady(true)
      }
    }

    void loadCloudData()

    return () => {
      controller.abort()
    }
  }, [hostedRuntime, syncCloudData])

  useEffect(() => {
    if (ownerMode) return undefined

    const refreshPublicData = () => {
      if (document.visibilityState === 'visible') {
        void syncCloudData()
      }
    }

    const timer = window.setInterval(refreshPublicData, 15_000)
    const updateChannel = 'BroadcastChannel' in window ? new BroadcastChannel(CLOUD_UPDATE_CHANNEL) : null
    updateChannel?.addEventListener('message', refreshPublicData)
    window.addEventListener('focus', refreshPublicData)
    document.addEventListener('visibilitychange', refreshPublicData)

    return () => {
      window.clearInterval(timer)
      updateChannel?.close()
      window.removeEventListener('focus', refreshPublicData)
      document.removeEventListener('visibilitychange', refreshPublicData)
    }
  }, [ownerMode, syncCloudData])

  useEffect(() => {
    if (!cloudReady || !cloudSynced || !ownerMode) return undefined

    const timer = window.setTimeout(() => {
      const previous = cloudSnapshotRef.current
      if (!previous) return

      const next = { adBanners, categories, categoryImages, heroVideo, posts }
      const patch = createCloudPatch(previous, next)
      if (!hasCloudPatchChanges(patch)) return

      cloudSnapshotRef.current = next
      void queueCloudPatch(patch, next).then((saved) => {
        if (!saved && cloudSnapshotRef.current === next) cloudSnapshotRef.current = previous
      })
    }, 450)

    return () => window.clearTimeout(timer)
  }, [adBanners, categories, categoryImages, cloudReady, cloudSynced, heroVideo, ownerMode, posts])

  const visibleCategories = useMemo(
    () => normalizeCategories([...categories, ...uniqueCategories(posts)]),
    [categories, posts],
  )

  const categoryCounts = useMemo(
    () =>
      visibleCategories.map((category) => ({
        name: category,
        count: posts.filter((post) => post.category === category).length,
      })),
    [posts, visibleCategories],
  )

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    return posts
      .filter((post) => statusFilter === 'all' || post.status === statusFilter)
      .filter((post) => categoryFilter === 'all' || post.category === categoryFilter)
      .filter((post) => {
        if (!keyword) return true

        return [post.title, post.excerpt, post.category, post.slug, post.tags.join(' '), post.content, post.productLinks.map((link) => `${link.mall} ${link.price} ${link.badge}`).join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [categoryFilter, posts, query, statusFilter])

  const selectAdminCategory = (category: string) => {
    setCategoryFilter(category)
    setQuery('')
    setStatusFilter('all')
  }

  const stats = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((post) => post.status === 'published').length,
      drafts: posts.filter((post) => post.status === 'draft').length,
      words: posts.reduce((sum, post) => sum + countWords(post.content), 0),
    }),
    [posts],
  )

  const updatePost = (patch: Partial<Post>) => {
    if (!activePost) return

    const normalizedPatch = patch.category ? { ...patch, category: normalizeCategoryName(patch.category) } : patch

    if (patch.category) {
      const category = normalizeCategoryName(patch.category)
      if (category && !categories.includes(category)) {
        setCategories((current) => [...current, category])
      }
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === activePost.id ? { ...post, ...normalizedPatch, updatedAt: new Date().toISOString() } : post,
      ),
    )
  }

  const updatePostById = (id: string, patch: Partial<Post>) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === id ? { ...post, ...patch, updatedAt: new Date().toISOString() } : post,
      ),
    )
  }

  const createCategory = () => {
    const name = window.prompt('새 셀럽/인플루언서 이름을 입력하세요.')
    const normalized = normalizeCategoryName(name)
    if (!normalized || categories.includes(normalized)) return

    setCategories((current) => [...current, normalized])
    setCategoryFilter(normalized)
  }

  const renameCategory = (category: string) => {
    const nextName = normalizeCategoryName(window.prompt('셀럽/인플루언서 이름을 변경하세요.', category))
    if (!nextName || nextName === category || categories.includes(nextName)) return

    setCategories((current) => current.map((name) => (name === category ? nextName : name)))
    setCategoryImages((current) => {
      const { [category]: image, ...rest } = current
      return image ? { ...rest, [nextName]: image } : rest
    })
    setPosts((current) =>
      current.map((post) =>
        post.category === category ? { ...post, category: nextName, updatedAt: new Date().toISOString() } : post,
      ),
    )
    setCategoryFilter((current) => (current === category ? nextName : current))
  }

  const deleteCategory = (category: string) => {
    const count = posts.filter((post) => post.category === category).length
    const message = count
      ? `"${category}" 셀럽을 삭제하고 ${count}개 상품을 "${UNCATEGORIZED}"로 옮길까요?`
      : `"${category}" 셀럽을 삭제할까요?`

    if (!window.confirm(message)) return

    setCategories((current) => {
      const remaining = current.filter((name) => name !== category)
      return count && !remaining.includes(UNCATEGORIZED) ? [...remaining, UNCATEGORIZED] : remaining
    })
    setCategoryImages((current) => {
      const { [category]: _removed, ...rest } = current
      return rest
    })
    setPosts((current) =>
      current.map((post) =>
        post.category === category ? { ...post, category: UNCATEGORIZED, updatedAt: new Date().toISOString() } : post,
      ),
    )
    setCategoryFilter((current) => (current === category ? 'all' : current))
  }

  const moveCategory = (category: string, direction: -1 | 1) => {
    setCategories((current) => {
      const orderedCategories = normalizeCategories([...current, ...uniqueCategories(posts)])
      const currentIndex = orderedCategories.indexOf(category)
      const nextIndex = currentIndex + direction

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedCategories.length) return current

      const nextCategories = [...orderedCategories]
      ;[nextCategories[currentIndex], nextCategories[nextIndex]] = [nextCategories[nextIndex], nextCategories[currentIndex]]
      return nextCategories
    })
  }

  const reorderCategory = (category: string, targetCategory: string) => {
    setCategories((current) => {
      const orderedCategories = normalizeCategories([...current, ...uniqueCategories(posts)])
      const sourceIndex = orderedCategories.indexOf(category)
      const targetIndex = orderedCategories.indexOf(targetCategory)

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current

      const nextCategories = [...orderedCategories]
      const [movedCategory] = nextCategories.splice(sourceIndex, 1)
      nextCategories.splice(targetIndex, 0, movedCategory)
      return nextCategories
    })
  }

  const createPost = (template: Partial<Post> = {}) => {
    const safeTemplate = isPostTemplate(template) ? template : {}
    const selectedCategory = normalizeCategoryName(categoryFilter === 'all' ? visibleCategories[0] ?? UNCATEGORIZED : categoryFilter)
    const next = {
      ...createEmptyPost(),
      ...safeTemplate,
      category: normalizeCategoryName(safeTemplate.category ?? selectedCategory) || UNCATEGORIZED,
      id: createId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setPosts((current) => [next, ...current])
    setActiveId(next.id)
    setView('editor')
    setSidebarOpen(false)
  }

  const deletePost = (id: string) => {
    const target = posts.find((post) => post.id === id)
    if (!target || !window.confirm(`"${target.title}" 상품을 삭제할까요?`)) return

    const remaining = posts.filter((post) => post.id !== id)
    setPosts(remaining)
    setActiveId(remaining[0]?.id ?? '')
    setView('editor')
  }

  const duplicatePost = () => {
    if (!activePost) return

    const copy: Post = {
      ...activePost,
      id: createId(),
      title: `${activePost.title} 복사본`,
      slug: `${activePost.slug}-copy-${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setPosts((current) => [copy, ...current])
    setActiveId(copy.id)
    setView('editor')
  }

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    updatePost({ coverImage: await imageFileToOptimizedDataUrl(file, 1600, 0.8) })
    event.target.value = ''
  }

  const handleAdBannerImageUpload = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const image = await fileToOptimizedBannerDataUrl(file)
      updateAdBanner(index, { image })
    } catch {
      window.alert('배너 이미지를 처리하지 못했습니다. 다른 이미지를 선택해 주세요.')
    } finally {
      event.target.value = ''
    }
  }

  const handleCategoryImageUpload = async (category: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const image = await fileToOptimizedCategoryDataUrl(file)
      setCategoryImages((current) => ({ ...current, [category]: image }))
    } catch {
      window.alert('셀럽 이미지를 처리하지 못했습니다. 다른 이미지를 선택해 주세요.')
    } finally {
      event.target.value = ''
    }
  }

  const clearCategoryImage = (category: string) => {
    setCategoryImages((current) => {
      const { [category]: _removed, ...rest } = current
      return rest
    })
  }

  const updateAdBanner = (index: number, patch: Partial<AdBannerSettings>) => {
    setAdBanners((current) =>
      current.map((banner, bannerIndex) => (bannerIndex === index ? { ...banner, ...patch } : banner)),
    )
  }

  const updateHeroVideo = (patch: Partial<HeroVideoSettings>) => {
    setHeroVideo((current) => ({ ...current, ...patch }))
  }

  const handleHeroVideoStickerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const stickerImage = await imageFileToOptimizedDataUrl(file, 720, 0.88)
      updateHeroVideo({ stickerImage })
    } catch {
      window.alert('스티커 이미지를 처리하지 못했습니다. 다른 이미지를 선택해 주세요.')
    } finally {
      event.target.value = ''
    }
  }

  const unlockOwnerMode = () => {
    const savedPassword = window.localStorage.getItem(OWNER_PASSWORD_KEY)

    if (!savedPassword) {
      const nextPassword = window.prompt('작성 모드 비밀번호를 처음 설정하세요.')
      if (!nextPassword?.trim()) return

      window.localStorage.setItem(OWNER_PASSWORD_KEY, nextPassword.trim())
      ensureAdminToken()
      setOwnerMode(true)
      setView('editor')
      return
    }

    const password = window.prompt('작성 모드 비밀번호를 입력하세요.')
    if (password === savedPassword) {
      ensureAdminToken()
      setOwnerMode(true)
      setView('editor')
      return
    }

    window.alert('비밀번호가 맞지 않습니다.')
  }

  const lockOwnerMode = () => {
    setOwnerMode(false)
    setSidebarOpen(false)
  }

  const exportBackup = () => {
    downloadJson(`ssen-shopping-backup-${new Date().toISOString().slice(0, 10)}.json`, {
      adBanners,
      categoryImages,
      exportedAt: new Date().toISOString(),
      categories,
      heroVideo,
      posts,
    })
  }

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const parsed = JSON.parse(text) as
      | { adBanner?: AdBannerSettings; adBanners?: AdBannerSettings[]; categories?: string[]; categoryImages?: Record<string, string>; heroVideo?: Partial<HeroVideoSettings>; posts?: Post[] }
      | Post[]
    const imported = Array.isArray(parsed) ? parsed : parsed.posts

    if (!imported?.length) return

    const nextCategories = Array.isArray(parsed) ? uniqueCategories(imported) : parsed.categories?.length ? parsed.categories : uniqueCategories(imported)
    const nextAdBanners = Array.isArray(parsed)
      ? adBanners
      : parsed.adBanners?.length
        ? normalizeAdBanners(parsed.adBanners)
        : parsed.adBanner
          ? normalizeAdBanners([parsed.adBanner])
          : adBanners
    const nextHeroVideo = Array.isArray(parsed) ? heroVideo : normalizeHeroVideo(parsed.heroVideo)

    setPosts(imported)
    setCategories(nextCategories)
    if (!Array.isArray(parsed)) {
      setCategoryImages(normalizeCategoryImages(parsed.categoryImages))
    }
    if (!Array.isArray(parsed)) {
      setAdBanners(nextAdBanners)
      setHeroVideo(nextHeroVideo)
    }
    setActiveId(imported[0].id)
    setView('editor')
    void saveCloudData({
      adBanners: nextAdBanners,
      categories: nextCategories,
      categoryImages: Array.isArray(parsed) ? categoryImages : normalizeCategoryImages(parsed.categoryImages),
      heroVideo: nextHeroVideo,
      posts: imported,
    })
    event.target.value = ''
  }

  return {
    activePost,
    adBanners,
    categoryCounts,
    categoryFilter,
    categoryImages,
    categories: visibleCategories,
    cloudReady,
    cloudSynced,
    createPost,
    createCategory,
    darkMode,
    deletePost,
    deleteCategory,
    duplicatePost,
    exportBackup,
    filteredPosts,
    handleCoverUpload,
    handleAdBannerImageUpload,
    handleCategoryImageUpload,
    handleHeroVideoStickerUpload,
    heroVideo,
    importBackup,
    importRef,
    lockOwnerMode,
    loadPostDetail,
    moveCategory,
    reorderCategory,
    ownerMode,
    query,
    posts,
    selectAdminCategory,
    setActiveId,
    setCategoryFilter,
    setDarkMode,
    setQuery,
    setSidebarOpen,
    setStatusFilter: setStatusFilter as (status: PostStatusFilter) => void,
    setView,
    sidebarOpen,
    stats,
    statusFilter,
    updatePost,
    updatePostById,
    updateAdBanner,
    updateHeroVideo,
    unlockOwnerMode,
    view,
    renameCategory,
    clearCategoryImage,
  }
}

export type BlogStudioModel = ReturnType<typeof useBlogStudio>
export type UpdatePost = (patch: Partial<Post>) => void
export type ChangeStatus = (status: PostStatus) => void

let cloudSaveWarningShown = false
let cloudPatchQueue: Promise<boolean> = Promise.resolve(true)

function ensureAdminToken() {
  const savedToken = window.localStorage.getItem(ADMIN_TOKEN_KEY)
  if (savedToken) return savedToken

  const nextToken = window.prompt('Netlify 환경변수 BLOG_ADMIN_TOKEN에 등록한 저장 토큰을 입력하세요.')
  if (!nextToken?.trim()) {
    window.alert('저장 토큰이 없으면 이 브라우저에는 저장되지만 Netlify 서버에는 저장되지 않습니다.')
    return ''
  }

  window.localStorage.setItem(ADMIN_TOKEN_KEY, nextToken.trim())
  return nextToken.trim()
}

async function saveCloudData(data: Required<Pick<CloudBlogData, 'adBanners' | 'categories' | 'categoryImages' | 'heroVideo' | 'posts'>>) {
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY)
  if (!token) return false

  try {
    const response = await fetch(getCloudDataEndpoint(), {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-blog-admin-token': token,
      },
      body: JSON.stringify(data),
    })

    if (response.status === 401) {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY)
      if (!cloudSaveWarningShown) {
        cloudSaveWarningShown = true
        window.alert('Netlify 저장 토큰이 맞지 않아 서버 저장에 실패했습니다. 글쓰기 모드에 다시 들어가 토큰을 확인해 주세요.')
      }
      return false
    }

    if (response.ok) announceCloudUpdate()
    return response.ok
  } catch {
    // 네트워크가 없거나 로컬 개발 서버에서는 서버 저장만 건너뜁니다.
    return false
  }
}

function queueCloudPatch(patch: CloudBlogPatch, fallbackData: CloudBlogSnapshot) {
  const queuedSave = cloudPatchQueue.then(() => saveCloudPatch(patch, fallbackData))
  cloudPatchQueue = queuedSave.catch(() => false)
  return queuedSave
}

async function saveCloudPatch(patch: CloudBlogPatch, fallbackData: CloudBlogSnapshot) {
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY)
  if (!token) return false

  try {
    const response = await fetch(getCloudDataEndpoint(), {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-blog-admin-token': token,
      },
      body: JSON.stringify(patch),
    })

    if (response.status === 401) {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY)
      if (!cloudSaveWarningShown) {
        cloudSaveWarningShown = true
        window.alert('Netlify 저장 토큰이 맞지 않아 서버 저장에 실패했습니다. 글쓰기 모드에 다시 들어가 토큰을 확인해 주세요.')
      }
      return false
    }

    // 새 PATCH 함수가 아직 배포되지 않은 로컬 개발 환경에서는 기존 전체 저장으로 한 번만 대체합니다.
    if (response.status === 404 || response.status === 405) {
      return saveCloudData(fallbackData)
    }

    if (response.ok) announceCloudUpdate()
    return response.ok
  } catch {
    return false
  }
}

function createCloudPatch(previous: CloudBlogSnapshot, next: CloudBlogSnapshot): CloudBlogPatch {
  const patch: CloudBlogPatch = {}

  if (previous.adBanners !== next.adBanners) patch.adBanners = next.adBanners
  if (previous.categories !== next.categories) patch.categories = next.categories
  if (previous.categoryImages !== next.categoryImages) patch.categoryImages = next.categoryImages
  if (previous.heroVideo !== next.heroVideo) patch.heroVideo = next.heroVideo

  const previousPosts = new Map(previous.posts.map((post) => [post.id, post]))
  const nextPostIds = new Set(next.posts.map((post) => post.id))
  const deletedPostIds = previous.posts.filter((post) => !nextPostIds.has(post.id)).map((post) => post.id)
  const postChanges = next.posts.flatMap((post) => {
    const previousPost = previousPosts.get(post.id)
    if (!previousPost) return [{ id: post.id, patch: post }]
    if (previousPost === post) return []

    const changedFields: Partial<Post> = {}
    ;(Object.keys(post) as Array<keyof Post>).forEach((key) => {
      if (previousPost[key] !== post[key]) Object.assign(changedFields, { [key]: post[key] })
    })

    return Object.keys(changedFields).length ? [{ id: post.id, patch: changedFields }] : []
  })

  if (deletedPostIds.length) patch.deletedPostIds = deletedPostIds
  if (postChanges.length) patch.postChanges = postChanges
  return patch
}

function hasCloudPatchChanges(patch: CloudBlogPatch) {
  return Object.keys(patch).length > 0
}

function createLightweightPostCache(posts: Post[]) {
  return posts.map((post) => ({
    ...post,
    content: '',
    coverImage: isEmbeddedImage(post.coverImage) ? '' : post.coverImage,
  }))
}

function createLightweightBannerCache(banners: AdBannerSettings[]) {
  return banners.map((banner) => ({
    ...banner,
    image: isEmbeddedImage(banner.image) ? '' : banner.image,
  }))
}

function createLightweightHeroVideoCache(settings: HeroVideoSettings): HeroVideoSettings {
  return {
    ...settings,
    stickerImage: isEmbeddedImage(settings.stickerImage) ? '' : settings.stickerImage,
  }
}

function stripEmbeddedImages(images: Record<string, string>) {
  return Object.fromEntries(Object.entries(images).filter(([, image]) => !isEmbeddedImage(image)))
}

function isEmbeddedImage(value: string) {
  return value.startsWith('data:image/')
}

function announceCloudUpdate() {
  if (!('BroadcastChannel' in window)) return

  const channel = new BroadcastChannel(CLOUD_UPDATE_CHANNEL)
  channel.postMessage({ type: 'updated' })
  channel.close()
}

function fileToOptimizedCategoryDataUrl(file: File) {
  return imageFileToOptimizedDataUrl(file, 720, 0.84)
}

function fileToOptimizedBannerDataUrl(file: File) {
  return imageFileToOptimizedDataUrl(file, 2100, 0.82)
}

function normalizeCategoryName(value: string | null) {
  return value?.trim().replace(/\s+/g, ' ') ?? ''
}

function normalizeCategories(values: unknown) {
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

function normalizeCategoryImages(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([category, image]) => [normalizeCategoryName(category), typeof image === 'string' ? image : ''] as const)
      .filter(([category, image]) => category && image),
  )
}

function uniqueCategories(posts: Post[]) {
  const names = posts.map((post) => normalizeCategoryName(post.category) || UNCATEGORIZED)
  return normalizeCategories(names.length ? names : [UNCATEGORIZED])
}

function normalizePosts(values: unknown, categoryHints: unknown = []): Post[] {
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
        coverImage: readString(value.coverImage, ''),
        purchaseTitle: readString(value.purchaseTitle, '최저가 제휴몰 바로가기'),
        productLinks: normalizeProductLinks(value.productLinks),
        status: normalizePostStatus(value.status),
        createdAt: readString(value.createdAt, new Date().toISOString()),
        updatedAt: readString(value.updatedAt, new Date().toISOString()),
      }
    })
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

function readSettings(storageKey = SETTINGS_KEY): BlogSettings {
  const stored = loadJson<Partial<BlogSettings> & { adBanner?: AdBannerSettings }>(storageKey, DEFAULT_SETTINGS)

  return {
    darkMode: stored.darkMode ?? DEFAULT_SETTINGS.darkMode,
    adBanners: stored.adBanners?.length ? normalizeAdBanners(stored.adBanners) : normalizeAdBanners(stored.adBanner ? [stored.adBanner] : []),
    heroVideo: normalizeHeroVideo(stored.heroVideo),
  }
}

function isHostedRuntime() {
  if (typeof window === 'undefined') return false

  return !['localhost', '127.0.0.1'].includes(window.location.hostname)
}

function isSecretAdminRuntime() {
  if (typeof window === 'undefined') return false

  return window.location.pathname === '/secret/sanghan' || window.location.pathname === '/blog/secret/sanghan'
}

function getCloudDataEndpoint() {
  if (typeof window === 'undefined') return CLOUD_DATA_ENDPOINT

  return ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5173'
    ? PRODUCTION_CLOUD_DATA_ENDPOINT
    : CLOUD_DATA_ENDPOINT
}

function isPostTemplate(value: unknown): value is Partial<Post> {
  if (!value || typeof value !== 'object') return true
  if ('nativeEvent' in value || 'currentTarget' in value || 'target' in value) return false

  return true
}

function normalizeAdBanners(banners: Partial<AdBannerSettings>[]) {
  const normalized = DEFAULT_AD_BANNERS.map((fallback, index) => ({
    ...fallback,
    ...banners[index],
    embedCode: typeof banners[index]?.embedCode === 'string' ? banners[index].embedCode : '',
    id: banners[index]?.id ?? fallback.id,
  }))

  const hasConfiguredBanner = normalized.some(
    (banner) => banner.enabled || banner.embedCode || banner.image || banner.href || banner.title !== `띠배너 영역 ${Number(banner.id.replace('banner-', '')) || 1}`,
  )

  if (!hasConfiguredBanner) {
    normalized[0] = {
      ...normalized[0],
      ...GMARKET_SAMPLE_BANNER,
    }
  }

  return normalized
}

function normalizeHeroVideo(value?: Partial<HeroVideoSettings>): HeroVideoSettings {
  const youtubeUrl = typeof value?.youtubeUrl === 'string' ? value.youtubeUrl : ''
  const visibilityConfigured = Boolean(value?.visibilityConfigured)

  return {
    ...DEFAULT_HERO_VIDEO,
    ...value,
    enabled: visibilityConfigured ? Boolean(value?.enabled) : Boolean(youtubeUrl.trim()),
    eyebrow: typeof value?.eyebrow === 'string' ? value.eyebrow : DEFAULT_HERO_VIDEO.eyebrow,
    title: typeof value?.title === 'string' ? value.title : DEFAULT_HERO_VIDEO.title,
    stickerImage: typeof value?.stickerImage === 'string' ? value.stickerImage : '',
    stickerHref: typeof value?.stickerHref === 'string' ? value.stickerHref : '',
    visibilityConfigured,
    youtubeUrl,
  }
}
