const ROW_ID = 'main'

type BlogData = {
  adBanners: unknown[]
  categories: string[]
  posts: unknown[]
  savedAt?: string | null
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
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

export async function handler(event: NetlifyEvent) {
  try {
    if (event.httpMethod === 'GET' && event.queryStringParameters?.debug === 'env') {
      return json(200, {
        hasBlogAdminToken: Boolean(process.env.BLOG_ADMIN_TOKEN),
        hasSupabaseServiceRoleKey: Boolean(readSupabaseServiceRoleKey()),
        hasSupabaseUrl: Boolean(readSupabaseUrl()),
      })
    }

    if (event.httpMethod === 'GET') {
      return json(200, await readSupabaseData())
    }

    if (event.httpMethod !== 'PUT') {
      return json(405, { message: 'Method not allowed' })
    }

    const adminToken = process.env.BLOG_ADMIN_TOKEN
    const requestToken = event.headers['x-blog-admin-token']

    if (!adminToken || requestToken !== adminToken) {
      return json(401, { message: '관리자 저장 토큰이 필요합니다.' })
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
  const response = await supabaseFetch(`/rest/v1/blog_content?id=eq.${ROW_ID}&select=data`)

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const rows = (await response.json()) as Array<{ data?: BlogData }>
  return rows[0]?.data ?? emptyData
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

function readSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
}
