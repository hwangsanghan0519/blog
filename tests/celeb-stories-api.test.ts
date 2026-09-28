import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const photo = { id: 'photo', caption: '오늘의 기록', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/photo.jpg', permalink: 'https://www.instagram.com/p/PHOTO/?tracking=1', timestamp: '2026-09-25T12:00:00+0000' }
const response = () => new Response(JSON.stringify({ business_discovery: {
  username: 'sooyoungchoi', biography: 'Profile', followers_count: 100,
  profile_picture_url: 'https://scontent.cdninstagram.com/avatar.jpg', media: { data: [photo] },
} }))
const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-26T00:00:00Z'))
  vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'private-test-token')
  vi.stubEnv('INSTAGRAM_USER_ID', '123456')
  vi.stubEnv('INSTAGRAM_GRAPH_VERSION', 'v26.0')
  vi.stubEnv('INSTAGRAM_CELEB_ACCOUNTS', '')
  for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY', 'SERVICE_ROLE_KEY', 'INSTAGRAM_PROFILE_CACHE_DIR']) vi.stubEnv(name, '')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockImplementation(async () => response())
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

async function request(username?: string) {
  const { handler } = await import('../netlify/functions/celeb-stories')
  return handler({ httpMethod: 'GET', queryStringParameters: username ? { username } : null })
}

describe('Instagram Business Discovery profiles', () => {
  it('returns a setup state without making an unauthenticated API call', async () => {
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', '')
    const result = await request()
    expect(result.statusCode).toBe(200)
    expect(JSON.parse(result.body)).toMatchObject({ state: 'unconfigured', fetchedAt: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the server token and returns only public fields', async () => {
    const result = await request('sooyoungchoi')
    expect(result.statusCode).toBe(200)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('https://graph.facebook.com/v26.0/123456')
    expect(url.searchParams.get('fields')).toContain('business_discovery.username(sooyoungchoi)')
    expect(url.searchParams.get('fields')).not.toMatch(/media|stories/);
    expect(JSON.parse(result.body)).not.toHaveProperty('media');
    expect(init.headers.authorization).toBe('Bearer private-test-token')
    expect(String(url)).not.toContain('private-test-token')
    expect(result.body).not.toContain('private-test-token')
    expect(JSON.parse(result.body)).toMatchObject({ state: 'ready', followers: 100 })
  })

  it('does not allow visitors to query unregistered or injected usernames', async () => {
    expect((await request('outsider')).statusCode).toBe(404)
    expect((await request('x){id}')).statusCode).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('coalesces requests and caches profiles for fifteen minutes', async () => {
    const results = await Promise.all([request(), request(), request()])
    expect(results.every((r) => r.statusCode === 200)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-26T00:14:00Z'))
    expect((await request()).headers['cache-control']).toContain('s-maxage=60')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-26T00:16:00Z'))
    await request()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('marks cached data stale on an outage, backs off, and preserves it beyond seven days', async () => {
    await request()
    fetchMock.mockRejectedValue(new Error('offline with private-test-token'))
    vi.setSystemTime(new Date('2026-09-26T00:16:00Z'))
    const stale = await request()
    expect(JSON.parse(stale.body)).toMatchObject({ state: 'stale', fetchedAt: '2026-09-26T00:00:00.000Z' })
    expect(stale.body).not.toContain('private-test-token')
    await request()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    vi.setSystemTime(new Date('2026-10-04T01:01:00Z'))
    const preserved = await request()
    expect(preserved.statusCode).toBe(200)
    expect(JSON.parse(preserved.body)).toMatchObject({ state: 'stale', followers: 100, fetchedAt: '2026-09-26T00:00:00.000Z' })
  })

  it('handles revoked credentials without exposing the upstream error', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-test-token expired' } }), { status: 400 }))
    const result = await request()
    expect(result.statusCode).toBe(503)
    expect(result.body).not.toContain('private-test-token')
    expect(JSON.parse(result.body).state).toBe('unavailable')
  })

  it('restores account snapshots after a cold start and token rotation without writing failures', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'private-storage-key')
    const accounts = [{ name: '수영', username: 'sooyoungchoi' }, { name: '채령', username: 'chaerrry0' }]
    const snapshots = new Map<string, unknown>()
    let rejected = false
    const graph = vi.fn()
    const writes = vi.fn()
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/rest/')) return new Response(JSON.stringify([{ celebAccounts: accounts }]))
      if (url.pathname.includes('/storage/')) {
        if (init?.method === 'POST') {
          writes()
          snapshots.set(url.pathname, JSON.parse(init.body))
          return new Response('{}')
        }
        const stored = snapshots.get(url.pathname)
        return new Response(JSON.stringify(stored ?? {}), { status: stored ? 200 : 404 })
      }
      graph()
      if (rejected) return new Response(JSON.stringify({ error: { code: 190 } }), { status: 400 })
      const username = url.searchParams.get('fields')!.includes('sooyoungchoi') ? 'sooyoungchoi' : 'chaerrry0'
      return new Response(JSON.stringify({ business_discovery: { username, followers_count: username === 'sooyoungchoi' ? 100 : 200 } }))
    })
    await request('sooyoungchoi')
    await request('chaerrry0')
    expect(writes).toHaveBeenCalledTimes(2)
    vi.resetModules()
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'rotated-token')
    rejected = true
    const restored = await request('sooyoungchoi')
    expect(JSON.parse(restored.body)).toMatchObject({ state: 'stale', followers: 100, issue: 'authentication' })
    expect(restored.headers['cache-control']).toBe('no-store')
    expect(JSON.parse((await request('chaerrry0')).body)).toMatchObject({ state: 'stale', followers: 200, issue: 'authentication' })
    const storageReads = () => fetchMock.mock.calls.filter(([url, init]) => String(url).includes('/storage/') && init?.method !== 'POST').length
    const calls = storageReads()
    await request('chaerrry0')
    expect(storageReads()).toBe(calls)
    expect(graph).toHaveBeenCalledTimes(3)
    expect(writes).toHaveBeenCalledTimes(2)
    expect(restored.body).not.toMatch(/private-storage-key|rotated-token/)
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', '')
    expect(JSON.parse((await request('sooyoungchoi')).body)).toMatchObject({ state: 'stale', followers: 100 })
    expect(graph).toHaveBeenCalledTimes(3)
  })

  it.each([
    [200, 190, 'authentication'], [403, 10, 'permission'], [429, 4, 'rate_limit'], [400, 110, 'account'],
  ])('classifies HTTP %s / Graph %s without retrying', async (status, code, issue) => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { code } }), { status }))
    const result = await request()
    expect(JSON.parse(result.body)).toMatchObject({ state: 'unavailable', issue })
    expect(result.headers['cache-control']).toBe('no-store')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('respects rate-limit retry timing across accounts and recovers', async () => {
    fetchMock.mockImplementation(async () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }))
    await request()
    vi.setSystemTime(new Date('2026-09-26T00:01:00Z'))
    expect(JSON.parse((await request('chaerrry0')).body).issue).toBe('rate_limit')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-26T00:02:01Z'))
    fetchMock.mockImplementation(async () => response())
    expect(JSON.parse((await request()).body).state).toBe('ready')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('invalidates cached data when credentials change', async () => {
    await request()
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'replacement')
    await request()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('backs off across accounts for expired authentication and retries with a new token immediately', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { code: 190, message: 'private-test-token expired' } }), { status: 400 }))
    expect(JSON.parse((await request()).body)).toMatchObject({ state: 'unavailable', issue: 'authentication' })
    expect(JSON.parse((await request('chaerrry0')).body).issue).toBe('authentication')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-26T00:04:00Z'))
    await request('yezyizhere')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-26T00:06:00Z'))
    await request()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'replacement')
    fetchMock.mockImplementation(async () => response())
    const recovered = await request()
    expect(JSON.parse(recovered.body)).toMatchObject({ state: 'ready', followers: 100 })
    expect(recovered.body).not.toContain('private-test-token')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('respects an empty published roster in local development', async () => {
    vi.stubEnv('INSTAGRAM_CELEB_ACCOUNTS', '[]')
    expect(JSON.parse((await request()).body)).toMatchObject({ accounts: [], followers: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses refreshed development credentials without retaining or mutating process credentials', async () => {
    const { handleCelebStories } = await import('../netlify/functions/celeb-stories')
    const env = { INSTAGRAM_ACCESS_TOKEN: 'dev-first', INSTAGRAM_USER_ID: '123456', INSTAGRAM_GRAPH_VERSION: 'v26.0' }
    const event = { httpMethod: 'GET' }
    expect(JSON.parse((await handleCelebStories(event, env)).body).state).toBe('ready')
    expect(JSON.parse((await handleCelebStories(event, { ...env, INSTAGRAM_ACCESS_TOKEN: 'dev-refreshed' })).body).state).toBe('ready')
    expect(fetchMock.mock.calls.map(([, init]) => init.headers.authorization)).toEqual(['Bearer dev-first', 'Bearer dev-refreshed'])
    expect(process.env.INSTAGRAM_ACCESS_TOKEN).toBe('private-test-token')
  })

  it('supports a configured roster and rejects malformed configuration', async () => {
    vi.stubEnv('INSTAGRAM_CELEB_ACCOUNTS', JSON.stringify([{ name: '테스트', username: '@example' }]))
    const { readCelebAccounts } = await import('../netlify/functions/celeb-stories')
    expect(readCelebAccounts()).toEqual([{ name: '테스트', username: 'example' }])
    vi.stubEnv('INSTAGRAM_CELEB_ACCOUNTS', '[{"name":"test","username":"x){id}"}]')
    expect((await request()).statusCode).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a response for a different account', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ business_discovery: { username: 'someone_else' } })))
    expect((await request()).statusCode).toBe(503)
  })

  it('keeps missing follower counts unknown', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ business_discovery: { username: 'sooyoungchoi', media: { data: [] } } })))
    expect(JSON.parse((await request()).body)).toMatchObject({ state: 'unavailable', followers: null, issue: 'invalid_response' })
  })

  it('rejects writes', async () => {
    const { handler } = await import('../netlify/functions/celeb-stories')
    expect((await handler({ httpMethod: 'POST' })).statusCode).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})


 it('recovers from a transient gateway error with one retry', async () => {
   fetchMock.mockResolvedValueOnce(new Response('{}', { status: 502 })).mockImplementation(async () => response())
   expect(JSON.parse((await request()).body).state).toBe('ready')
   expect(fetchMock).toHaveBeenCalledTimes(2)
 })
 it('uses the admin roster instead of the default allowlist', async () => {
   vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
   vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'server-only')
   fetchMock.mockImplementation(async (url) => String(url).includes('supabase.co')
     ? new Response(JSON.stringify([{ celebAccounts: [{ name: '새 셀럽', username: 'new_celeb' }] }]))
     : new Response(JSON.stringify({ business_discovery: { username: 'new_celeb', followers_count: 1234 } })))
   expect(JSON.parse((await request('new_celeb')).body)).toMatchObject({ state: 'ready', followers: 1234, account: { name: '새 셀럽' } })
   expect((await request('sooyoungchoi')).statusCode).toBe(404)
 })
