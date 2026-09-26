import { createHash } from 'node:crypto'
import { DEFAULT_CELEB_ACCOUNTS } from '../../src/pages/commerce-studio/model/celebAccounts.ts'
import type { CelebAccount, CelebStoryFeed } from '../../src/pages/commerce-studio/model/celebStoryTypes.ts'
import { readStoredCelebAccounts } from './blog-data.ts'

type Event = { httpMethod: string; queryStringParameters?: Record<string, string | undefined> | null }
const FRESH_MS = 15 * 60_000
const STALE_MS = 60 * 60_000
const cache = new Map<string, { feed: CelebStoryFeed; retryAt: number }>()
const requests = new Map<string, Promise<CelebStoryFeed>>()

function json(statusCode: number, body: unknown, ttl = 0) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'cache-control': ttl ? `public, max-age=0, s-maxage=${ttl}` : 'no-store',
      ...(statusCode === 503 ? { 'retry-after': '60' } : {}),
    },
    body: JSON.stringify(body),
  }
}

export function readCelebAccounts(): CelebAccount[] {
  if (!process.env.INSTAGRAM_CELEB_ACCOUNTS) return DEFAULT_CELEB_ACCOUNTS
  const parsed: unknown = JSON.parse(process.env.INSTAGRAM_CELEB_ACCOUNTS)
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 30) throw new Error('Invalid accounts')
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
  if (event.httpMethod === 'OPTIONS') return json(204, null)
  if (event.httpMethod !== 'GET') return json(405, { message: 'Method not allowed' })
  let accounts: CelebAccount[]
  try { accounts = await readStoredCelebAccounts() ?? readCelebAccounts() } catch { return json(503, { message: '셀럽스토리를 준비하고 있습니다.' }) }
  if (!accounts.length) return json(200, { accounts, account: { name: '', username: '' }, profileImage: '', followers: null, fetchedAt: null, state: 'unconfigured' })
  const username = event.queryStringParameters?.username ?? accounts[0].username
  const account = accounts.find((item) => item.username === username)
  if (!account) return json(404, { message: '등록된 셀럽 계정을 찾을 수 없습니다.' })
  const empty: CelebStoryFeed = {
    accounts, account, profileImage: '', followers: null, fetchedAt: null, state: 'unconfigured',
  }
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
  const userId = process.env.INSTAGRAM_USER_ID?.trim()
  const version = process.env.INSTAGRAM_GRAPH_VERSION?.trim() || 'v26.0'
  if (!token || !userId || !version || !/^\d+$/.test(userId) || !/^v\d+\.0$/.test(version)) {
    return json(200, empty, 60)
  }

  // 인증 변경 시 이전 계정의 캐시를 재사용하지 않고, 토큰은 응답과 URL에 넣지 않습니다.
  const key = createHash('sha256').update(JSON.stringify([token, userId, version, accounts, username])).digest('hex')
  const cached = cache.get(key)
  const age = cached?.feed.fetchedAt ? Date.now() - Date.parse(cached.feed.fetchedAt) : Infinity
  if (cached && age < FRESH_MS && cached.feed.state === 'ready') {
    return json(200, cached.feed, Math.max(1, Math.floor((FRESH_MS - age) / 1000)))
  }
  if (cached && cached.retryAt > Date.now()) return json(cached.feed.state === 'unavailable' ? 503 : 200, cached.feed, 60)
  let request = requests.get(key)
  if (!request) {
    request = loadFeed(account, accounts, userId, token, version).then((feed) => {
      if (cache.size >= 60) cache.delete(cache.keys().next().value!)
      cache.set(key, { feed, retryAt: 0 })
      return feed
    }).catch(() => {
      const feed: CelebStoryFeed = cached && age < STALE_MS && cached.feed.fetchedAt
        ? { ...cached.feed, state: 'stale' }
        : { ...empty, state: 'unavailable' }
      cache.set(key, { feed, retryAt: Date.now() + 60_000 })
      return feed
    }).finally(() => requests.delete(key))
    requests.set(key, request)
  }
  const feed = await request
  return json(feed.state === 'unavailable' ? 503 : 200, feed, feed.state === 'ready' ? FRESH_MS / 1000 : 60)
}

async function loadFeed(account: CelebAccount, accounts: CelebAccount[], userId: string, token: string, version: string): Promise<CelebStoryFeed> {
  const url = new URL(`https://graph.facebook.com/${version}/${userId}`)
  url.searchParams.set('fields', `business_discovery.username(${account.username}){username,profile_picture_url,followers_count}`)
  // Retry transient transport/server failures once, but not revoked credentials or invalid accounts.
  let response: Response | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) })
      if (attempt === 0 && [502, 503, 504].includes(response.status)) continue
      break
    } catch (error) { if (attempt === 1) throw error }
  }
  if (!response) throw new Error('Instagram unavailable')
  if (!response.ok) throw new Error('Instagram request failed')
  const payload: unknown = await response.json()
  if (!record(payload) || !record(payload.business_discovery)) throw new Error('Missing profile')
  const profile = payload.business_discovery
  if (typeof profile.username !== 'string' || profile.username.toLowerCase() !== account.username) throw new Error('Account mismatch')
  return {
    accounts, account, profileImage: mediaUrl(profile.profile_picture_url),
    followers: typeof profile.followers_count === 'number' && Number.isFinite(profile.followers_count) && profile.followers_count >= 0 ? profile.followers_count : null,
    fetchedAt: new Date().toISOString(), state: 'ready',
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mediaUrl(value: unknown) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      && ['cdninstagram.com', 'fbcdn.net', 'instagram.com'].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : ''
  } catch { return '' }
}
