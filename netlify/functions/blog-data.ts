const ROW_ID = 'main'

type BlogData = {
  adBanners: unknown[]
  categories: string[]
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
  posts: [],
  savedAt: null,
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'access-control-allow-headers': 'content-type, x-blog-admin-token',
    'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
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
      return json(200, await readSupabaseData())
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

    if (!Array.isArray(payload.posts) || !Array.isArray(payload.categories) || !Array.isArray(payload.adBanners)) {
      return json(400, { message: '저장 데이터 형식이 올바르지 않습니다.' })
    }

    const data: BlogData = {
      adBanners: payload.adBanners,
      categories: payload.categories,
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
    storedPostCount: merged.posts.length,
    storedPostTitles: merged.posts.map((post) =>
      typeof post === 'object' && post !== null && 'title' in post ? String(post.title) : '제목 없음',
    ),
  }
}

function mergeBlogRows(rows: BlogContentRow[]): BlogData {
  const categories = new Set<string>()
  const posts = new Map<string, unknown>()
  let adBanners: unknown[] = []
  let savedAt: string | null = null

  rows.forEach((row, rowIndex) => {
    const data = row.data
    if (!data) return

    if (!adBanners.length && Array.isArray(data.adBanners) && data.adBanners.length) {
      adBanners = data.adBanners
    }

    if (Array.isArray(data.categories)) {
      data.categories.forEach((category) => {
        if (typeof category === 'string' && category.trim()) {
          categories.add(category.trim())
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
    categories: Array.from(categories).sort((a, b) => a.localeCompare(b, 'ko')),
    posts: Array.from(posts.values()),
    savedAt,
  }
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
