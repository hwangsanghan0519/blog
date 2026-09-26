import type { Post } from '../../../entities/post/model/types'
import {
  CLOUD_DATA_ENDPOINT,
  CLOUD_UPDATE_CHANNEL,
  PRODUCTION_CLOUD_DATA_ENDPOINT,
} from '../model/config'
import type { CloudCommercePatch, CloudCommerceSnapshot } from '../model/types'

export type CloudSaveResult = { saved: true } | { saved: false; message: string }

let cloudPatchQueue: Promise<CloudSaveResult> = Promise.resolve({ saved: true })

export async function saveCloudData(
  data: CloudCommerceSnapshot,
) {
  return saveRequest('PUT', data)
}

/** 순서를 보장해 느린 이전 요청이 최신 편집 내용을 덮어쓰지 않게 합니다. */
export function queueCloudPatch(patch: CloudCommercePatch, fallbackData: CloudCommerceSnapshot) {
  const queuedSave = cloudPatchQueue.then(() => saveCloudPatch(patch, fallbackData))
  cloudPatchQueue = queuedSave.catch(() => ({ saved: false, message: '저장 실패 · 다시 시도해 주세요' }))
  return queuedSave
}

export function createCloudPatch(previous: CloudCommerceSnapshot, next: CloudCommerceSnapshot): CloudCommercePatch {
  const patch: CloudCommercePatch = {}

  if (previous.adBanners !== next.adBanners) patch.adBanners = next.adBanners
  if (previous.categories !== next.categories) patch.categories = next.categories
  if (previous.categoryImages !== next.categoryImages) patch.categoryImages = next.categoryImages
  if (previous.heroVideo !== next.heroVideo) patch.heroVideo = next.heroVideo

  if (previous.celebAccounts !== next.celebAccounts) patch.celebAccounts = next.celebAccounts

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
  // 탭 간 알림이 차단된 브라우저에서도 완료된 서버 저장은 성공으로 처리합니다.
  try {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel(CLOUD_UPDATE_CHANNEL)
    try {
      channel.postMessage({ type: 'updated' })
    } finally {
      channel.close()
    }
  } catch {
    // 공개 화면은 주기적인 서버 조회로도 갱신됩니다.
  }
}

async function saveCloudPatch(patch: CloudCommercePatch, fallbackData: CloudCommerceSnapshot) {
  return saveRequest('PATCH', patch, fallbackData)
}

async function saveRequest(
  method: 'PATCH' | 'PUT',
  data: CloudCommercePatch | CloudCommerceSnapshot,
  fallbackData?: CloudCommerceSnapshot,
): Promise<CloudSaveResult> {
  // AbortSignal.timeout이 없는 모바일 WebView에서도 요청을 시작할 수 있게 합니다.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(getCloudDataEndpoint(), {
      method,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    })


    // 새 PATCH 함수가 아직 배포되지 않은 환경에서는 기존 전체 저장 계약으로 대체합니다.
    if (fallbackData && (response.status === 404 || response.status === 405)) {
      return saveCloudData(fallbackData)
    }

    if (response.ok) {
      announceCloudUpdate()
      return { saved: true }
    }
    const reason = response.status === 413 ? '이미지 용량 초과'
      : response.status === 400 ? '저장 데이터 확인 필요'
        : response.status === 401 || response.status === 403 ? '접근 권한 확인 필요'
          : `서버 오류 ${response.status}`
    return { saved: false, message: `저장 실패 · ${reason}` }
  } catch {
    return { saved: false, message: controller.signal.aborted
      ? '저장 실패 · 응답 시간 초과'
      : '저장 실패 · 네트워크 연결 확인' }
  } finally {
    clearTimeout(timer)
  }
}
