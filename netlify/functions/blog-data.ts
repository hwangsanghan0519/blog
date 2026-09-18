import { createHash } from 'node:crypto'

const ROW_ID = 'main'
const SUMMARY_ROW_ID = 'main-summary'
const ASSET_BUCKET = 'blog-assets'

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

type BlogDataPatch = {
  adBanners?: unknown[]
  categories?: string[]
  categoryImages?: Record<string, string>
  deletedPostIds?: string[]
  heroVideo?: Record<string, unknown> | null
  postChanges?: Array<{ id: string; patch: Record<string, unknown> }>
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
    'access-control-allow-methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
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
      const requestedAsset = event.queryStringParameters?.asset?.trim()
      const requestedAssetId = event.queryStringParameters?.id?.trim()
      const requestedPost = event.queryStringParameters?.post?.trim()

      if (event.queryStringParameters?.view === 'summary' && !requestedAsset && !requestedPost) {
        const storedSummary = await readSupabaseSummary()
        if (storedSummary) return json(200, storedSummary)

        const fullData = await readSupabaseData()
        const summary = createPublicSummary(fullData)
        await writeSupabaseSummary(summary)
        return json(200, summary)
      }

      const data = await readSupabaseData()

      if (requestedAsset && requestedAssetId) {
        const asset = findPublicAsset(data, requestedAsset, requestedAssetId)
        if (!asset) return json(404, { message: '이미지를 찾을 수 없습니다.' })

        if (!isEmbeddedImageData(asset)) return createAssetRedirect(asset)

        const storageUrl = await uploadEmbeddedImage(asset, requestedAsset)
        if (storageUrl !== asset) return createAssetRedirect(storageUrl)

        return createAssetResponse(asset)
      }

      if (requestedPost) {
        const post = data.posts.find((item) => isMatchingPublishedPost(item, requestedPost))
        return post ? json(200, post) : json(404, { message: '상품을 찾을 수 없습니다.' })
      }

      return json(200, data)
    }

    if (event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH' && event.httpMethod !== 'DELETE') {
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

    if (event.httpMethod === 'PATCH') {
      const patch = JSON.parse(event.body ?? '{}') as BlogDataPatch

      if (!isValidBlogDataPatch(patch)) {
        return json(400, { message: '부분 저장 데이터 형식이 올바르지 않습니다.' })
      }

      const current = await readSupabaseData()
      const posts = new Map<string, Record<string, unknown>>()

      current.posts.forEach((post, index) => {
        if (!isRecord(post)) return
        posts.set(readPostKey(post, 'patch', index), post)
      })
      patch.deletedPostIds?.forEach((postId) => posts.delete(postId))
      patch.postChanges?.forEach((change) => {
        const previous = posts.get(change.id) ?? {}
        posts.set(change.id, { ...previous, ...change.patch, id: change.id })
      })

      const data: BlogData = {
        adBanners: patch.adBanners ?? current.adBanners,
        categories: patch.categories ?? current.categories,
        categoryImages: patch.categoryImages ?? current.categoryImages,
        heroVideo: patch.heroVideo === undefined ? current.heroVideo : patch.heroVideo,
        posts: Array.from(posts.values()),
        savedAt: new Date().toISOString(),
      }

      await writeSupabaseData(data)
      return json(200, { savedAt: data.savedAt })
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
  const response = await supabaseFetch(`/rest/v1/blog_content?id=neq.${SUMMARY_ROW_ID}&select=id,updated_at,data&order=updated_at.desc`)

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return (await response.json()) as BlogContentRow[]
}

async function readSupabaseSummary() {
  const response = await supabaseFetch(`/rest/v1/blog_content?id=eq.${SUMMARY_ROW_ID}&select=data&limit=1`)
  if (!response.ok) throw new Error(await response.text())

  const [row] = (await response.json()) as BlogContentRow[]
  return row?.data && isBlogData(row.data) ? row.data : null
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
  const version = data.savedAt ?? 'latest'

  return {
    ...data,
    adBanners: data.adBanners.map((banner, index) => {
      if (!isRecord(banner)) return banner
      const bannerId = typeof banner.id === 'string' && banner.id ? banner.id : String(index)
      const image = typeof banner.image === 'string' ? banner.image : ''
      return { ...banner, image: publicAssetUrl('banner', bannerId, version, image) }
    }),
    categoryImages: Object.fromEntries(
      Object.entries(data.categoryImages).map(([category, image]) => [
        category,
        publicAssetUrl('category', category, version, image),
      ]),
    ),
    posts: data.posts
      .filter((post): post is Record<string, unknown> => isRecord(post) && post.status === 'published')
      .map((post) => {
        const postId = typeof post.id === 'string' ? post.id : ''
        const coverImage = typeof post.coverImage === 'string' ? post.coverImage : ''
        return { ...post, content: '', coverImage: publicAssetUrl('post', postId, version, coverImage) }
      }),
  }
}

function publicAssetUrl(kind: string, id: string, version: string, source: string) {
  if (!id || !isEmbeddedImageData(source)) return source
  return `/.netlify/functions/blog-data?asset=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}&v=${encodeURIComponent(version)}`
}

function findPublicAsset(data: BlogData, kind: string, id: string) {
  if (kind === 'post') {
    const post = data.posts.find((item) => isMatchingPublishedPost(item, id))
    return isRecord(post) && typeof post.coverImage === 'string' ? post.coverImage : ''
  }

  if (kind === 'category') return data.categoryImages[id] ?? ''

  if (kind === 'banner') {
    const banner = data.adBanners.find((item, index) => {
      if (!isRecord(item)) return false
      const bannerId = typeof item.id === 'string' && item.id ? item.id : String(index)
      return bannerId === id
    })
    return isRecord(banner) && typeof banner.image === 'string' ? banner.image : ''
  }

  return ''
}

function createAssetResponse(dataUrl: string) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) return json(404, { message: '이미지 형식이 올바르지 않습니다.' })

  const [, contentType, base64Marker, payload] = match
  return {
    statusCode: 200,
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': contentType,
    },
    body: base64Marker ? payload : decodeURIComponent(payload),
    ...(base64Marker ? { isBase64Encoded: true } : {}),
  }
}

function createAssetRedirect(location: string) {
  return {
    statusCode: 302,
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=31536000, immutable',
      location,
    },
    body: '',
  }
}

function isEmbeddedImageData(value: string) {
  return value.startsWith('data:image/')
}

function isMatchingPublishedPost(value: unknown, requestedPost: string) {
  if (!isRecord(value) || value.status !== 'published') return false
  return value.id === requestedPost || value.slug === requestedPost
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isBlogData(value: unknown): value is BlogData {
  if (!isRecord(value)) return false
  return (
    Array.isArray(value.adBanners) &&
    Array.isArray(value.categories) &&
    isStringRecord(value.categoryImages) &&
    isOptionalRecord(value.heroVideo) &&
    Array.isArray(value.posts)
  )
}

function isValidBlogDataPatch(value: BlogDataPatch) {
  return (
    (value.adBanners === undefined || Array.isArray(value.adBanners)) &&
    (value.categories === undefined || (Array.isArray(value.categories) && value.categories.every((item) => typeof item === 'string'))) &&
    (value.categoryImages === undefined || isStringRecord(value.categoryImages)) &&
    (value.deletedPostIds === undefined || (Array.isArray(value.deletedPostIds) && value.deletedPostIds.every((item) => typeof item === 'string'))) &&
    isOptionalRecord(value.heroVideo) &&
    (value.postChanges === undefined || (
      Array.isArray(value.postChanges) &&
      value.postChanges.every((change) => isRecord(change) && typeof change.id === 'string' && isRecord(change.patch))
    ))
  )
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
  const optimizedData = await externalizeEmbeddedImages(data)
  const updatedAt = new Date().toISOString()
  const response = await supabaseFetch('/rest/v1/blog_content?on_conflict=id', {
    body: JSON.stringify([
      { data: optimizedData, id: ROW_ID, updated_at: updatedAt },
      { data: createPublicSummary(optimizedData), id: SUMMARY_ROW_ID, updated_at: updatedAt },
    ]),
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }
}

async function externalizeEmbeddedImages(data: BlogData): Promise<BlogData> {
  const uploadCache = new Map<string, Promise<string>>()
  const upload = (source: string, kind: string) => {
    if (!isEmbeddedImageData(source)) return Promise.resolve(source)

    const cached = uploadCache.get(source)
    if (cached) return cached

    const request = uploadEmbeddedImage(source, kind)
    uploadCache.set(source, request)
    return request
  }

  const adBanners = await Promise.all(data.adBanners.map(async (banner) => {
    if (!isRecord(banner) || typeof banner.image !== 'string') return banner
    return { ...banner, image: await upload(banner.image, 'banner') }
  }))

  const categoryImages = Object.fromEntries(await Promise.all(
    Object.entries(data.categoryImages).map(async ([category, image]) => [category, await upload(image, 'category')]),
  ))

  const posts = await Promise.all(data.posts.map(async (post) => {
    if (!isRecord(post)) return post

    const coverImage = typeof post.coverImage === 'string' ? await upload(post.coverImage, 'post') : post.coverImage
    const content = typeof post.content === 'string' ? await externalizeContentImages(post.content, upload) : post.content
    return { ...post, coverImage, content }
  }))

  return { ...data, adBanners, categoryImages, posts }
}

async function externalizeContentImages(content: string, upload: (source: string, kind: string) => Promise<string>) {
  const matches = Array.from(content.matchAll(/src=(['"])(data:image\/[^'"]+)\1/g))
  if (!matches.length) return content

  let nextContent = content
  const uniqueSources = Array.from(new Set(matches.map((match) => match[2])))
  await Promise.all(uniqueSources.map(async (source) => {
    const url = await upload(source, 'content')
    nextContent = nextContent.split(source).join(url)
  }))
  return nextContent
}

async function uploadEmbeddedImage(source: string, kind: string) {
  if (!isEmbeddedImageData(source)) return source

  try {
    const asset = parseImageDataUrl(source)
    if (!asset) return source

    await ensureAssetBucket()
    const hash = createHash('sha256').update(asset.buffer).digest('hex').slice(0, 32)
    const objectPath = `${kind}/${hash}.${extensionForContentType(asset.contentType)}`
    const response = await supabaseStorageFetch(`/storage/v1/object/${ASSET_BUCKET}/${objectPath}`, {
      body: asset.buffer,
      headers: {
        'content-type': asset.contentType,
        'x-upsert': 'true',
      },
      method: 'POST',
    })

    if (!response.ok) return source
    return `${readSupabaseUrl()}/storage/v1/object/public/${ASSET_BUCKET}/${objectPath}`
  } catch {
    return source
  }
}

let assetBucketReady: Promise<boolean> | null = null

function ensureAssetBucket() {
  if (assetBucketReady) return assetBucketReady

  assetBucketReady = (async () => {
    const existing = await supabaseStorageFetch(`/storage/v1/bucket/${ASSET_BUCKET}`)
    if (existing.ok) return true

    const created = await supabaseStorageFetch('/storage/v1/bucket', {
      body: JSON.stringify({ id: ASSET_BUCKET, name: ASSET_BUCKET, public: true }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    return created.ok || created.status === 409
  })()

  return assetBucketReady
}

function parseImageDataUrl(source: string) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(source)
  if (!match) return null

  const [, contentType, base64Marker, payload] = match
  return {
    buffer: base64Marker ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload)),
    contentType,
  }
}

function extensionForContentType(contentType: string) {
  const extensions: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  }
  return extensions[contentType.toLowerCase()] ?? 'img'
}

async function writeSupabaseSummary(data: BlogData) {
  const response = await supabaseFetch('/rest/v1/blog_content?on_conflict=id', {
    body: JSON.stringify({ data, id: SUMMARY_ROW_ID, updated_at: new Date().toISOString() }),
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    method: 'POST',
  })

  if (!response.ok) throw new Error(await response.text())
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

function supabaseStorageFetch(path: string, init?: RequestInit) {
  const url = readSupabaseUrl()
  const serviceRoleKey = readSupabaseServiceRoleKey()

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase Storage 환경변수가 필요합니다.')
  }

  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
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
