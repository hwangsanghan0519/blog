import { getCloudDataEndpoint } from './commerceApi'
import type { CelebStoryFeed } from '../model/celebStoryTypes'

// 컴포넌트 재마운트와 목록 갱신이 인증 실패 계정의 반복 조회를 재개하지 않도록 유지합니다.
let authenticationFailure: { endpoint: string; feeds: Map<string, CelebStoryFeed>; retryAt: number } | undefined

export async function fetchCelebStories(username: string, signal: AbortSignal): Promise<CelebStoryFeed> {
  signal.throwIfAborted()
  const endpoint = import.meta.env.DEV ? '/.netlify/functions/celeb-stories' : getCloudDataEndpoint().replace('/blog-data', '/celeb-stories')
  if (authenticationFailure?.endpoint === endpoint && authenticationFailure.retryAt > Date.now()) {
    // 다른 계정은 한 번 조회해 서버에 저장된 해당 계정의 정상 값을 복원합니다.
    const cached = authenticationFailure.feeds.get(username)
    if (cached) return cached
  }
  const response = await fetch(`${endpoint}${username ? `?username=${encodeURIComponent(username)}` : ''}`, {
    headers: { accept: 'application/json' }, signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Stories unavailable')
  const feed = await response.json() as CelebStoryFeed
  if (!Array.isArray(feed.accounts) || !feed.account
    || !['ready', 'stale', 'unconfigured', 'unavailable'].includes(feed.state)) throw new Error('Invalid stories')
  if (feed.issue === 'authentication') {
    if (!authenticationFailure || authenticationFailure.endpoint !== endpoint || authenticationFailure.retryAt <= Date.now()) {
      authenticationFailure = { endpoint, feeds: new Map(), retryAt: Date.now() + 5 * 60_000 }
    }
    authenticationFailure.feeds.set(username, feed)
  } else if (feed.state === 'ready') {
    authenticationFailure = undefined
  }
  return feed
}
