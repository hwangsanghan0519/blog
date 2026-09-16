import { getStore } from '@netlify/blobs'

const STORE_NAME = 'blog-studio'
const DATA_KEY = 'content'

type BlogData = {
  adBanners?: unknown[]
  categories?: string[]
  posts?: unknown[]
  savedAt?: string
}

type NetlifyEvent = {
  body: string | null
  headers: Record<string, string | undefined>
  httpMethod: string
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
  const store = getStore(STORE_NAME)

  if (event.httpMethod === 'GET') {
    const data = await store.get<BlogData>(DATA_KEY, { type: 'json' })
    return json(200, data ?? { adBanners: [], categories: [], posts: [] })
  }

  if (event.httpMethod !== 'PUT') {
    return json(405, { message: 'Method not allowed' })
  }

  const token = process.env.BLOG_ADMIN_TOKEN
  const requestToken = event.headers['x-blog-admin-token']

  if (!token || requestToken !== token) {
    return json(401, { message: '관리자 저장 토큰이 필요합니다.' })
  }

  const payload = JSON.parse(event.body ?? '{}') as BlogData

  if (!Array.isArray(payload.posts) || !Array.isArray(payload.categories) || !Array.isArray(payload.adBanners)) {
    return json(400, { message: '저장 데이터 형식이 올바르지 않습니다.' })
  }

  const data = {
    adBanners: payload.adBanners,
    categories: payload.categories,
    posts: payload.posts,
    savedAt: new Date().toISOString(),
  }

  await store.setJSON(DATA_KEY, data)

  return json(200, data)
}
