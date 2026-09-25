import type { Post } from '../../../entities/post/model/types'
import {
  CLOUD_DATA_ENDPOINT,
  CLOUD_UPDATE_CHANNEL,
  PRODUCTION_CLOUD_DATA_ENDPOINT,
} from '../model/config'
import type { CloudCommercePatch, CloudCommerceSnapshot } from '../model/types'

let cloudPatchQueue: Promise<boolean> = Promise.resolve(true)

export async function saveCloudData(
  data: CloudCommerceSnapshot,
) {
  try {
    const response = await fetch(getCloudDataEndpoint(), {
      method: 'PUT',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    })

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
  try {
    const response = await fetch(getCloudDataEndpoint(), {
      method: 'PATCH',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(patch),
    })


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
