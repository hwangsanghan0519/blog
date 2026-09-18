import type { Post } from '../../../entities/post/model/types'
import {
  CLOUD_DATA_ENDPOINT,
  CLOUD_UPDATE_CHANNEL,
  PRODUCTION_CLOUD_DATA_ENDPOINT,
  STORAGE_KEYS,
} from '../model/config'
import type { CloudCommerceData, CloudCommercePatch, CloudCommerceSnapshot } from '../model/types'

let cloudSaveWarningShown = false
let cloudPatchQueue: Promise<boolean> = Promise.resolve(true)

export function ensureAdminToken() {
  const savedToken = window.localStorage.getItem(STORAGE_KEYS.adminToken)
  if (savedToken) return savedToken

  const nextToken = window.prompt('Netlify 환경변수 BLOG_ADMIN_TOKEN에 등록한 저장 토큰을 입력하세요.')
  if (!nextToken?.trim()) {
    window.alert('저장 토큰이 없으면 이 브라우저에는 저장되지만 Netlify 서버에는 저장되지 않습니다.')
    return ''
  }

  window.localStorage.setItem(STORAGE_KEYS.adminToken, nextToken.trim())
  return nextToken.trim()
}

export async function saveCloudData(
  data: Required<Pick<CloudCommerceData, 'adBanners' | 'categories' | 'categoryImages' | 'heroVideo' | 'posts'>>,
) {
  const token = window.localStorage.getItem(STORAGE_KEYS.adminToken)
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

    if (response.status === 401) return handleUnauthorizedSave()
    if (response.ok) announceCloudUpdate()
    return response.ok
  } catch {
    // 네트워크가 없거나 로컬 개발 서버에서는 서버 저장만 건너뜁니다.
    return false
  }
}

/** 순서를 보장해 느린 이전 요청이 최신 편집 내용을 덮어쓰지 않게 합니다. */
export function queueCloudPatch(patch: CloudCommercePatch, fallbackData: CloudCommerceSnapshot) {
  const queuedSave = cloudPatchQueue.then(() => saveCloudPatch(patch, fallbackData))
  cloudPatchQueue = queuedSave.catch(() => false)
  return queuedSave
}

export function createCloudPatch(previous: CloudCommerceSnapshot, next: CloudCommerceSnapshot): CloudCommercePatch {
  const patch: CloudCommercePatch = {}

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

export function hasCloudPatchChanges(patch: CloudCommercePatch) {
  return Object.keys(patch).length > 0
}

export function isHostedRuntime() {
  if (typeof window === 'undefined') return false
  return !['localhost', '127.0.0.1'].includes(window.location.hostname)
}

export function isSecretAdminRuntime() {
  if (typeof window === 'undefined') return false
  return window.location.pathname === '/secret/sanghan' || window.location.pathname === '/blog/secret/sanghan'
}

export function getCloudDataEndpoint() {
  if (typeof window === 'undefined') return CLOUD_DATA_ENDPOINT

  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? PRODUCTION_CLOUD_DATA_ENDPOINT
    : CLOUD_DATA_ENDPOINT
}

function announceCloudUpdate() {
  if (!('BroadcastChannel' in window)) return

  const channel = new BroadcastChannel(CLOUD_UPDATE_CHANNEL)
  channel.postMessage({ type: 'updated' })
  channel.close()
}

async function saveCloudPatch(patch: CloudCommercePatch, fallbackData: CloudCommerceSnapshot) {
  const token = window.localStorage.getItem(STORAGE_KEYS.adminToken)
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

    if (response.status === 401) return handleUnauthorizedSave()

    // 새 PATCH 함수가 아직 배포되지 않은 환경에서는 기존 전체 저장 계약으로 대체합니다.
    if (response.status === 404 || response.status === 405) {
      return saveCloudData(fallbackData)
    }

    if (response.ok) announceCloudUpdate()
    return response.ok
  } catch {
    return false
  }
}

function handleUnauthorizedSave() {
  window.localStorage.removeItem(STORAGE_KEYS.adminToken)
  if (!cloudSaveWarningShown) {
    cloudSaveWarningShown = true
    window.alert('Netlify 저장 토큰이 맞지 않아 서버 저장에 실패했습니다. 글쓰기 모드에 다시 들어가 토큰을 확인해 주세요.')
  }
  return false
}
