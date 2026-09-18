const ROW_ID = 'main'

type BlogData = {
  adBanners: unknown[]
  categories: string[]
  categoryImages: Record<string, string>
  heroVideo: Record<string, unknown> | null
  posts: unknown[]
  savedAt?: string | null
}

type BlogContentRow = {
  data?: Partial<BlogData> | null
  id?: string
  updated_at?: string
}

type NetlifyEvent = {
  body: string | null
  headers: Record<string, string | undefined>
  httpMethod: string
  queryStringParameters?: Record<string, string | undefined> | null
}

const emptyData: BlogData = {
  adBanners: [],
  categories: [],
  categoryImages: {},
  heroVideo: null,
  posts: [],
  savedAt: null,
}

const json = (statusCode: number, body: unknown, cacheControl = 'no-store') => ({
  statusCode,
  headers: {
    'access-control-allow-headers': 'content-type, x-blog-admin-token',
    'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
    'cache-control': cacheControl,
    'content-type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

export async function handler(event: NetlifyEvent) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return json(204, null)
    }

    if (event.httpMethod === 'GET' && event.queryStringParameters?.debug === 'env') {
      const source = await readSupabaseSourceDebug()

      return json(200, {
        hasBlogAdminToken: Boolean(process.env.BLOG_ADMIN_TOKEN),
        hasSupabaseServiceRoleKey: Boolean(readSupabaseServiceRoleKey()),
        hasSupabaseUrl: Boolean(readSupabaseUrl()),
        ...source,
      })
    }

    if (event.httpMethod === 'GET') {
      const data = await readSupabaseData()
      const requestedPost = event.queryStringParameters?.post?.trim()

      if (requestedPost) {
        const post = data.posts.find((item) => isMatchingPublishedPost(item, requestedPost))
        return post ? json(200, post, 'private, max-age=60') : json(404, { message: '상품을 찾을 수 없습니다.' })
      }

      if (event.queryStringParameters?.view === 'summary') {
        return json(200, createPublicSummary(data), 'public, max-age=30, stale-while-revalidate=120')
      }

      return json(200, data)
    }

    if (event.httpMethod !== 'PUT' && event.httpMethod !== 'DELETE') {
      return json(405, { message: 'Method not allowed' })
    }

    const adminToken = process.env.BLOG_ADMIN_TOKEN
    const requestToken = event.headers['x-blog-admin-token']

    if (!adminToken || requestToken !== adminToken) {
      return json(401, { message: '관리자 저장 토큰이 필요합니다.' })
    }

    if (event.httpMethod === 'DELETE') {
      await clearSupabaseData()
      return json(200, emptyData)
    }

    const payload = JSON.parse(event.body ?? '{}') as BlogData

    if (
      !Array.isArray(payload.posts) ||
      !Array.isArray(payload.categories) ||
      !Array.isArray(payload.adBanners) ||
      !isStringRecord(payload.categoryImages) ||
      !isOptionalRecord(payload.heroVideo)
    ) {
      return json(400, { message: '저장 데이터 형식이 올바르지 않습니다.' })
    }

    const data: BlogData = {
      adBanners: payload.adBanners,
      categories: payload.categories,
      categoryImages: payload.categoryImages,
      heroVideo: payload.heroVideo ?? null,
      posts: payload.posts,
      savedAt: new Date().toISOString(),
    }

    await writeSupabaseData(data)

    return json(200, data)
  } catch (error) {
    return json(500, { message: error instanceof Error ? error.message : '서버 저장소 오류가 발생했습니다.' })
  }
}

async function readSupabaseData() {
  const rows = await readSupabaseRows()
  return mergeBlogRows(rows)
}

async function readSupabaseRows() {
  const response = await supabaseFetch('/rest/v1/blog_content?select=id,updated_at,data&order=updated_at.desc')

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return (await response.json()) as BlogContentRow[]
}

async function readSupabaseSourceDebug() {
  const rows = await readSupabaseRows()
  const merged = mergeBlogRows(rows)
  const mainRow = rows.find((row) => row.id === ROW_ID)

  return {
    rowCount: rows.length,
    rowIds: rows.map((row) => row.id ?? 'unknown'),
    mainRowExists: Boolean(mainRow),
    mainRowUpdatedAt: mainRow?.updated_at ?? null,
    sourceProjectRef: readSupabaseProjectRef(),
    sourceSupabaseHost: readSupabaseHost(),
    storedCategories: merged.categories,
    storedCategoryImageCount: Object.keys(merged.categoryImages).length,
    storedPostCount: merged.posts.length,
    storedPostTitles: merged.posts.map((post) =>
      typeof post === 'object' && post !== null && 'title' in post ? String(post.title) : '제목 없음',
    ),
  }
}

function mergeBlogRows(rows: BlogContentRow[]): BlogData {
  const categories = new Set<string>()
  const categoryImages: Record<string, string> = {}
  const posts = new Map<string, unknown>()
  let adBanners: unknown[] = []
  let heroVideo: Record<string, unknown> | null = null
  let savedAt: string | null = null

  rows.forEach((row, rowIndex) => {
    const data = row.data
    if (!data) return

    if (!adBanners.length && Array.isArray(data.adBanners) && data.adBanners.length) {
      adBanners = data.adBanners
    }

    if (!heroVideo && isOptionalRecord(data.heroVideo) && data.heroVideo) {
      heroVideo = data.heroVideo
    }

    if (Array.isArray(data.categories)) {
      data.categories.forEach((category) => {
        if (typeof category === 'string' && category.trim()) {
          categories.add(category.trim())
        }
      })
    }

    if (isStringRecord(data.categoryImages)) {
      Object.entries(data.categoryImages).forEach(([category, image]) => {
        const categoryName = category.trim()
        if (categoryName && image && !categoryImages[categoryName]) {
          categoryImages[categoryName] = image
          categories.add(categoryName)
        }
      })
    }

    if (Array.isArray(data.posts)) {
      data.posts.forEach((post, postIndex) => {
        if (typeof post !== 'object' || post === null) return

        const postKey = readPostKey(post, row.id ?? `row-${rowIndex}`, postIndex)
        if (!posts.has(postKey)) {
          posts.set(postKey, post)
        }

        if ('category' in post && typeof post.category === 'string' && post.category.trim()) {
          categories.add(post.category.trim())
        }
      })
    }

    const rowSavedAt = typeof data.savedAt === 'string' ? data.savedAt : row.updated_at
    if (rowSavedAt && (!savedAt || Date.parse(rowSavedAt) > Date.parse(savedAt))) {
      savedAt = rowSavedAt
    }
  })

  return {
    adBanners,
    categories: Array.from(categories),
    categoryImages,
    heroVideo,
    posts: Array.from(posts.values()),
    savedAt,
  }
}

function createPublicSummary(data: BlogData): BlogData {
  return {
    ...data,
    posts: data.posts
      .filter((post): post is Record<string, unknown> => isRecord(post) && post.status === 'published')
      .map((post) => ({ ...post, content: '' })),
  }
}

function isMatchingPublishedPost(value: unknown, requestedPost: string) {
  if (!isRecord(value) || value.status !== 'published') return false
  return value.id === requestedPost || value.slug === requestedPost
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) => typeof item === 'string')
}

function isOptionalRecord(value: unknown): value is Record<string, unknown> | null | undefined {
  return value === undefined || value === null || (typeof value === 'object' && !Array.isArray(value))
}

function readPostKey(post: object, rowId: string, index: number) {
  if ('id' in post && typeof post.id === 'string' && post.id) return post.id
  if ('slug' in post && typeof post.slug === 'string' && post.slug) return `slug:${post.slug}`
  return `${rowId}:${index}`
}

async function writeSupabaseData(data: BlogData) {
  const response = await supabaseFetch('/rest/v1/blog_content?on_conflict=id', {
    body: JSON.stringify({
      data,
      id: ROW_ID,
      updated_at: new Date().toISOString(),
    }),
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }
}

async function clearSupabaseData() {
  const deleteResponse = await supabaseFetch('/rest/v1/blog_content?id=neq.__never__', {
    headers: {
      Prefer: 'return=minimal',
    },
    method: 'DELETE',
  })

  if (!deleteResponse.ok) {
    throw new Error(await deleteResponse.text())
  }

  await writeSupabaseData(emptyData)
}

function supabaseFetch(path: string, init?: RequestInit) {
  const url = readSupabaseUrl()
  const serviceRoleKey = readSupabaseServiceRoleKey()

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Supabase 환경변수가 필요합니다. SUPABASE_URL=${url ? 'ok' : 'missing'}, SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey ? 'ok' : 'missing'}`,
    )
  }

  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
}

function readSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

function readSupabaseHost() {
  const url = readSupabaseUrl()

  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function readSupabaseProjectRef() {
  return readSupabaseHost().replace('.supabase.co', '')
}

function readSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
}
