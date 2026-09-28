import { createHash } from 'node:crypto'
import { DEFAULT_CELEB_ACCOUNTS } from '../../src/pages/commerce-studio/model/celebAccounts.ts'
import type { CelebAccount, CelebStoryFeed } from '../../src/pages/commerce-studio/model/celebStoryTypes.ts'
import { readStoredCelebAccounts } from './blog-data.ts'
import { fetchInstagramProfile, InstagramError, record } from './lib/instagram-graph.ts'
import type { InstagramIssue } from './lib/instagram-graph.ts'
import { readProfileSnapshot, saveProfileSnapshot } from './lib/instagram-cache.ts'
import type { StorageEnvironment } from './lib/instagram-cache.ts'

type Event = { httpMethod: string; queryStringParameters?: Record<string, string | undefined> | null }
type InstagramEnvironment = Partial<Record<'INSTAGRAM_ACCESS_TOKEN' | 'INSTAGRAM_USER_ID' | 'INSTAGRAM_GRAPH_VERSION' | 'INSTAGRAM_CELEB_ACCOUNTS', string>> & StorageEnvironment
const FRESH_MS = 15 * 60_000
const cache = new Map<string, { feed: CelebStoryFeed; retryAt: number }>()
const requests = new Map<string, Promise<CelebStoryFeed>>()
const credentialBackoff = new Map<string, { retryAt: number; issue: InstagramIssue }>()

function json(statusCode: number, body: unknown, ttl = 0) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'cache-control': ttl && statusCode === 200 ? `public, max-age=0, s-maxage=${ttl}` : 'no-store',
      ...(statusCode === 503 ? { 'retry-after': '60' } : {}),
    },
    body: JSON.stringify(body),
  }
}

export function readCelebAccounts(env: InstagramEnvironment = process.env): CelebAccount[] {
  if (!env.INSTAGRAM_CELEB_ACCOUNTS) return DEFAULT_CELEB_ACCOUNTS
  const parsed: unknown = JSON.parse(env.INSTAGRAM_CELEB_ACCOUNTS)
  if (!Array.isArray(parsed) || parsed.length > 30) throw new Error('Invalid accounts')
  const accounts = parsed.map((item) => {
    if (!record(item) || typeof item.name !== 'string' || typeof item.username !== 'string') throw new Error('Invalid account')
    const name = item.name.trim()
    const username = item.username.replace(/^@/, '').trim().toLowerCase()
    if (!name || name.length > 50 || !/^[a-z0-9_][a-z0-9_.]{0,29}$/.test(username)) throw new Error('Invalid account')
    return { name, username }
  })
  if (new Set(accounts.map((a) => a.name)).size !== accounts.length
    || new Set(accounts.map((a) => a.username)).size !== accounts.length) throw new Error('Duplicate account')
  return accounts
}

export async function handler(event: Event) {
  return handleCelebStories(event, process.env)
}

export async function handleCelebStories(event: Event, env: InstagramEnvironment) {
  if (event.httpMethod === 'OPTIONS') return json(204, null)
  if (event.httpMethod !== 'GET') return json(405, { message: 'Method not allowed' })
  let accounts: CelebAccount[]
  try { accounts = await readStoredCelebAccounts() ?? readCelebAccounts(env) } catch { return json(503, { message: '셀럽스토리를 준비하고 있습니다.' }) }
  if (!accounts.length) return json(200, { accounts, account: { name: '', username: '' }, profileImage: '', followers: null, fetchedAt: null, state: 'unconfigured' })
  const username = event.queryStringParameters?.username ?? accounts[0].username
  const account = accounts.find((item) => item.username === username)
  if (!account) return json(404, { message: '등록된 셀럽 계정을 찾을 수 없습니다.' })
  const empty: CelebStoryFeed = {
    accounts, account, profileImage: '', followers: null, fetchedAt: null, state: 'unconfigured',
  }
  const token = env.INSTAGRAM_ACCESS_TOKEN?.trim()
  const userId = env.INSTAGRAM_USER_ID?.trim()
  const version = env.INSTAGRAM_GRAPH_VERSION?.trim() || 'v26.0'
  if (!token || !userId || !version || !/^\d+$/.test(userId) || !/^v\d+\.0$/.test(version)) {
    const snapshot = await readProfileSnapshot(username, env)
    if (snapshot) return json(200, { ...empty, followers: snapshot.followers, profileImage: snapshot.profileImage, fetchedAt: snapshot.fetchedAt, state: 'stale' })
    return json(200, empty, 60)
  }

  // 인증 변경 시 이전 계정의 캐시를 재사용하지 않고, 토큰은 응답과 URL에 넣지 않습니다.
  const key = createHash('sha256').update(JSON.stringify([token, userId, version, accounts, username])).digest('hex')
  const credentialKey = createHash('sha256').update(JSON.stringify([token, userId, version])).digest('hex')
  let cached = cache.get(key)
  const age = cached?.feed.fetchedAt ? Date.now() - Date.parse(cached.feed.fetchedAt) : Infinity
  if (cached && age < FRESH_MS && cached.feed.state === 'ready') {
    return json(200, cached.feed, Math.max(1, Math.floor((FRESH_MS - age) / 1000)))
  }
  if (cached && cached.retryAt > Date.now()) {
    return json(cached.feed.state === 'unavailable' ? 503 : 200, cached.feed, 0)
  }
  let request = requests.get(key)
  if (!request) {
    request = (async () => {
      // 마지막 정상 값은 재시작·배포·토큰 교체 후에도 복원하며 실패 응답으로 덮어쓰지 않습니다.
      if (!cached?.feed.fetchedAt) {
        const snapshot = await readProfileSnapshot(username, env)
        if (snapshot) cached = { feed: { accounts, account, followers: snapshot.followers, profileImage: snapshot.profileImage, fetchedAt: snapshot.fetchedAt, state: 'stale' }, retryAt: 0 }
      }
      const fallback = (issue: InstagramIssue): CelebStoryFeed => cached?.feed.fetchedAt
        ? { ...cached.feed, accounts, account, state: 'stale', issue }
        : { ...empty, state: 'unavailable', issue }
      const blocked = credentialBackoff.get(credentialKey)
      if (blocked && blocked.retryAt > Date.now()) {
        const feed = fallback(blocked.issue)
        if (cache.size >= 60) cache.delete(cache.keys().next().value!)
        cache.set(key, { feed, retryAt: blocked.retryAt })
        return feed
      }
      try {
        const snapshot = await fetchInstagramProfile(account.username, userId, token, version)
        const feed: CelebStoryFeed = { accounts, account, profileImage: snapshot.profileImage, followers: snapshot.followers, fetchedAt: snapshot.fetchedAt, state: 'ready' }
        await saveProfileSnapshot(snapshot, env)
        credentialBackoff.delete(credentialKey)
        if (cache.size >= 60) cache.delete(cache.keys().next().value!)
        cache.set(key, { feed, retryAt: 0 })
        return feed
      } catch (error: unknown) {
        const failure = error instanceof InstagramError ? error : new InstagramError('upstream')
        if (['authentication', 'permission', 'rate_limit'].includes(failure.issue)) {
          if (credentialBackoff.size >= 10) credentialBackoff.delete(credentialBackoff.keys().next().value!)
          credentialBackoff.set(credentialKey, { retryAt: Date.now() + failure.retryAfter * 1000, issue: failure.issue })
        }
        const feed = fallback(failure.issue)
        if (cache.size >= 60) cache.delete(cache.keys().next().value!)
        cache.set(key, { feed, retryAt: Date.now() + failure.retryAfter * 1000 })
        return feed
      }
    })().finally(() => requests.delete(key))
    requests.set(key, request)
  }
  const feed = await request
  return json(feed.state === 'unavailable' ? 503 : 200, feed, feed.state === 'ready' ? FRESH_MS / 1000 : 0)
}
