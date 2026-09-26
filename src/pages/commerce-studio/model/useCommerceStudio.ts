import { normalizeCelebAccounts } from './celebAccounts'
import type { CelebAccount } from './celebStoryTypes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createEmptyPost } from '../../../entities/post/model/factory'
import type { Post, PostStatusFilter } from '../../../entities/post/model/types'
import { createId } from '../../../shared/lib/id'
import { downloadJson, imageFileToOptimizedDataUrl } from '../../../shared/lib/file'
import { loadJson, saveJson } from '../../../shared/lib/storage'
import {
  createCloudPatch,
  getCloudDataEndpoint,
  hasCloudPatchChanges,
  isHostedRuntime,
  isSecretAdminRuntime,
  queueCloudPatch,
} from '../api/commerceApi'
import {
  createLightweightBannerCache,
  createLightweightHeroVideoCache,
  createLightweightPostCache,
  stripEmbeddedImages,
} from '../lib/cache'
import {
  isPostTemplate,
  normalizeAdBanners,
  normalizeCategories,
  normalizeCategoryImages,
  normalizeCategoryName,
  normalizeHeroVideo,
  normalizePosts,
  readSettings,
  uniqueCategories,
} from '../lib/normalizers'
import {
  CLOUD_UPDATE_CHANNEL,
  DEFAULT_AD_BANNERS,
  DEFAULT_HERO_VIDEO,
  STORAGE_KEYS,
} from './config'
import type {
  AdBannerSettings,
  CloudCommerceData,
  CloudCommerceSnapshot,
  CommerceSettings,
  HeroVideoSettings,
  ViewMode,
} from './types'

export function useCommerceStudio() {
  const hostedRuntime = isHostedRuntime()
  const publicSummaryMode = hostedRuntime && !isSecretAdminRuntime()
  const lightweightCacheMode = hostedRuntime || isSecretAdminRuntime()
  const postsCacheKey = lightweightCacheMode ? STORAGE_KEYS.publicPosts : STORAGE_KEYS.posts
  const settingsCacheKey = lightweightCacheMode ? STORAGE_KEYS.publicSettings : STORAGE_KEYS.settings
  const initialSettings = readSettings(lightweightCacheMode ? STORAGE_KEYS.publicSettings : STORAGE_KEYS.settings)
  const [posts, setPosts] = useState<Post[]>(() =>
    normalizePosts(loadJson<unknown>(postsCacheKey, [])),
  )
  const [categories, setCategories] = useState<string[]>(() =>
    normalizeCategories(loadJson<unknown>(STORAGE_KEYS.categories, uniqueCategories(posts))),
  )
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>(() =>
    normalizeCategoryImages(
      loadJson<unknown>(lightweightCacheMode ? STORAGE_KEYS.publicCategoryImages : STORAGE_KEYS.categoryImages, {}),
    ),
  )
  const [activeId, setActiveId] = useState(posts[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PostStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [view, setView] = useState<ViewMode>('editor')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode] = useState(initialSettings.darkMode)
  const [adBanners, setAdBanners] = useState<AdBannerSettings[]>(initialSettings.adBanners)
  const [celebAccounts, setCelebAccounts] = useState(() => normalizeCelebAccounts(initialSettings.celebAccounts))
  const [heroVideo, setHeroVideo] = useState<HeroVideoSettings>(initialSettings.heroVideo)
  const [ownerMode, setOwnerMode] = useState(isSecretAdminRuntime)
  // 재방문자는 검증된 캐시를 즉시 사용하고, 첫 방문자만 샘플 데이터 대신 스켈레톤을 봅니다.
  const [cloudReady, setCloudReady] = useState(() => !isSecretAdminRuntime() && hasCompleteInitialCache(postsCacheKey, settingsCacheKey))
  const [cloudSynced, setCloudSynced] = useState(false)
  const [saveStatus, setSaveStatus] = useState('서버 연결 중')
  const [saveRevision, setSaveRevision] = useState(0)
  const savingRef = useRef(false)
  const importRef = useRef<HTMLInputElement>(null)
  const detailedPostsRef = useRef(new Map<string, Post>())
  const cloudSnapshotRef = useRef<CloudCommerceSnapshot | null>(null)

  const activePost = posts.find((post) => post.id === activeId) ?? posts[0]

  const syncCloudData = useCallback(async (signal?: AbortSignal) => {
    const endpoint = getCloudDataEndpoint()
    const response = await fetch(publicSummaryMode ? `${endpoint}?view=summary` : endpoint, {
      cache: publicSummaryMode ? 'no-store' : 'default',
      headers: { accept: 'application/json' },
      signal,
    })
    if (!response.ok) return false

    const data = (await response.json()) as CloudCommerceData
    if (signal?.aborted) return false

    const cloudCategories = normalizeCategories(data.categories)
    const cloudPosts = normalizePosts(data.posts, cloudCategories).map(
      (post) => detailedPostsRef.current.get(post.id) ?? post,
    )
    const nextCategories = normalizeCategories([...cloudCategories, ...uniqueCategories(cloudPosts)])
    const nextCategoryImages = normalizeCategoryImages(data.categoryImages)
    const nextAdBanners = data.adBanners?.length ? normalizeAdBanners(data.adBanners) : DEFAULT_AD_BANNERS
    const nextCelebAccounts = normalizeCelebAccounts(data.celebAccounts)
    const nextHeroVideo = normalizeHeroVideo(data.heroVideo)

    if (!publicSummaryMode) {
      cloudSnapshotRef.current = {
        adBanners: nextAdBanners,
        categories: nextCategories,
        categoryImages: nextCategoryImages,
        heroVideo: nextHeroVideo,
        celebAccounts: nextCelebAccounts,
        posts: cloudPosts,
      }
    }

    setPosts(cloudPosts)
    setCategories(nextCategories)
    setCategoryImages(nextCategoryImages)
    setAdBanners(nextAdBanners)
    setHeroVideo(nextHeroVideo)
    setCelebAccounts(nextCelebAccounts)
    setActiveId((current) => (cloudPosts.some((post) => post.id === current) ? current : cloudPosts[0]?.id ?? ''))
    setCloudSynced(true)
    setSaveStatus('서버 저장됨')
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
      saveJson(
        postsCacheKey,
        lightweightCacheMode ? createLightweightPostCache(posts) : posts,
      )
    }, 900)

    return () => window.clearTimeout(timer)
  }, [lightweightCacheMode, posts, postsCacheKey])

  useEffect(() => {
    const timer = window.setTimeout(() => saveJson(STORAGE_KEYS.categories, categories), 500)
    return () => window.clearTimeout(timer)
  }, [categories])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(
        lightweightCacheMode ? STORAGE_KEYS.publicCategoryImages : STORAGE_KEYS.categoryImages,
        lightweightCacheMode ? stripEmbeddedImages(categoryImages) : categoryImages,
      )
    }, 900)

    return () => window.clearTimeout(timer)
  }, [categoryImages, lightweightCacheMode])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveJson(lightweightCacheMode ? STORAGE_KEYS.publicSettings : STORAGE_KEYS.settings, {
        darkMode,
        celebAccounts,
        adBanners: lightweightCacheMode ? createLightweightBannerCache(adBanners) : adBanners,
        heroVideo: lightweightCacheMode ? createLightweightHeroVideoCache(heroVideo) : heroVideo,
      })
    }, 900)

    return () => window.clearTimeout(timer)
  }, [celebAccounts, adBanners, darkMode, heroVideo, lightweightCacheMode])

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true
    const requestTimeout = window.setTimeout(() => controller.abort(), 10_000)

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
        window.clearTimeout(requestTimeout)
        if (isMounted) {
          setCloudReady(true)
          if (!cloudSnapshotRef.current && isSecretAdminRuntime()) setSaveStatus('서버 연결 실패')
        }
      }
    }

    void loadCloudData()

    return () => {
      isMounted = false
      window.clearTimeout(requestTimeout)
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
    if (!cloudReady || !cloudSynced || !ownerMode || savingRef.current) return
    const previous = cloudSnapshotRef.current
    if (!previous) return
    const next = { adBanners, categories, categoryImages, heroVideo, posts, celebAccounts }
    const patch = createCloudPatch(previous, next)
    if (!hasCloudPatchChanges(patch)) {
      setSaveStatus('서버 저장됨')
      return
    }

    setSaveStatus('저장 대기 중')
    const timer = window.setTimeout(() => {
      savingRef.current = true
      setSaveStatus('서버 저장 중…')
      void queueCloudPatch(patch, next).then((result) => {
        if (result.saved) cloudSnapshotRef.current = next
        savingRef.current = false
        setSaveStatus(result.saved ? '서버 저장됨' : result.message)
        if (result.saved) setSaveRevision((revision) => revision + 1)
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [celebAccounts, adBanners, categories, categoryImages, cloudReady, cloudSynced, heroVideo, ownerMode, posts, saveRevision])

  useEffect(() => {
    if (!ownerMode) return
    const retryWhenOnline = () => setSaveRevision((revision) => revision + 1)
    window.addEventListener('online', retryWhenOnline)
    return () => window.removeEventListener('online', retryWhenOnline)
  }, [ownerMode])

  useEffect(() => {
    if (!ownerMode) return
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      const previous = cloudSnapshotRef.current
      if (savingRef.current || (previous && hasCloudPatchChanges(createCloudPatch(previous, { adBanners, categories, categoryImages, heroVideo, posts, celebAccounts })))) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warnUnsaved)
    return () => window.removeEventListener('beforeunload', warnUnsaved)
  }, [celebAccounts, adBanners, categories, categoryImages, heroVideo, ownerMode, posts])

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
      ? `"${category}" 셀럽을 삭제하고 ${count}개 상품의 셀럽 연결을 해제할까요? 상품은 유지됩니다.`
      : `"${category}" 셀럽을 삭제할까요?`

    if (!window.confirm(message)) return

    setCategories((current) => current.filter((name) => name !== category))
    setCategoryImages((current) => {
      const { [category]: _removed, ...rest } = current
      return rest
    })
    setPosts((current) =>
      current.map((post) =>
        post.category === category ? { ...post, category: '', updatedAt: new Date().toISOString() } : post,
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
    const selectedCategory = normalizeCategoryName(categoryFilter === 'all' ? visibleCategories[0] ?? '' : categoryFilter)
    const next = {
      ...createEmptyPost(),
      ...safeTemplate,
      category: normalizeCategoryName(safeTemplate.category ?? selectedCategory),
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

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      updatePost({ coverImage: await imageFileToOptimizedDataUrl(file, 1600, 0.8) })
    } catch {
      window.alert('대표 이미지를 처리하지 못했습니다. JPG 또는 PNG 사진으로 다시 선택해 주세요.')
    } finally {
      event.target.value = ''
    }
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

  const lockOwnerMode = () => {
    setOwnerMode(false)
    setSidebarOpen(false)
  }

  const exportBackup = () => {
    downloadJson(`powerpuffceleb-shopping-backup-${new Date().toISOString().slice(0, 10)}.json`, {
      adBanners,
      categoryImages,
      celebAccounts,
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
      | { celebAccounts?: CelebAccount[]; adBanner?: AdBannerSettings; adBanners?: AdBannerSettings[]; categories?: string[]; categoryImages?: Record<string, string>; heroVideo?: Partial<HeroVideoSettings>; posts?: Post[] }
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
      setCelebAccounts(normalizeCelebAccounts(parsed.celebAccounts))
      setAdBanners(nextAdBanners)
      setHeroVideo(nextHeroVideo)
    }
    setActiveId(imported[0].id)
    setView('editor')
    event.target.value = ''
  }

  return {
    activePost,
    celebAccounts,
    setCelebAccounts,
    adBanners,
    categoryCounts,
    categoryFilter,
    categoryImages,
    categories: visibleCategories,
    cloudReady,
    cloudSynced,
    saveStatus,
    retrySave: () => setSaveRevision((revision) => revision + 1),
    createPost,
    createCategory,
    deletePost,
    deleteCategory,
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
    setQuery,
    setSidebarOpen,
    setStatusFilter: setStatusFilter as (status: PostStatusFilter) => void,
    setView,
    sidebarOpen,
    statusFilter,
    updatePost,
    updateAdBanner,
    updateHeroVideo,
    view,
    renameCategory,
    clearCategoryImage,
  }
}


function fileToOptimizedCategoryDataUrl(file: File) {
  return imageFileToOptimizedDataUrl(file, 720, 0.84)
}

function fileToOptimizedBannerDataUrl(file: File) {
  return imageFileToOptimizedDataUrl(file, 2100, 0.82)
}

function hasCompleteInitialCache(postsKey: string, settingsKey: string) {
  try {
    const cachedPosts = window.localStorage.getItem(postsKey)
    const cachedSettings = window.localStorage.getItem(settingsKey)
    if (cachedPosts === null || cachedSettings === null) return false

    const posts = JSON.parse(cachedPosts) as unknown
    const settings = JSON.parse(cachedSettings) as unknown
    return Array.isArray(posts)
      && Boolean(settings)
      && typeof settings === 'object'
      && Array.isArray((settings as Partial<CommerceSettings>).adBanners)
      && Boolean((settings as Partial<CommerceSettings>).heroVideo)
  } catch {
    return false
  }
}
