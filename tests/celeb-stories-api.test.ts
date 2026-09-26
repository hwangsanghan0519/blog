import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const photo = { id: 'photo', caption: '오늘의 기록', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/photo.jpg', permalink: 'https://www.instagram.com/p/PHOTO/?tracking=1', timestamp: '2026-09-25T12:00:00+0000' }
const response = () => new Response(JSON.stringify({ business_discovery: {
  username: 'sooyoungchoi', biography: 'Profile', followers_count: 100,
  profile_picture_url: 'https://scontent.cdninstagram.com/avatar.jpg', media: { data: [photo] },
} }))
const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T00:00:00Z'))
  vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'private-test-token')
  vi.stubEnv('INSTAGRAM_USER_ID', '123456')
  vi.stubEnv('INSTAGRAM_GRAPH_VERSION', 'v26.0')
  vi.stubEnv('INSTAGRAM_CELEB_ACCOUNTS', '')
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

  it('marks cached data stale on an outage, backs off, and expires it', async () => {
    await request()
    fetchMock.mockRejectedValue(new Error('offline with private-test-token'))
    vi.setSystemTime(new Date('2026-09-26T00:16:00Z'))
    const stale = await request()
    expect(JSON.parse(stale.body)).toMatchObject({ state: 'stale', fetchedAt: '2026-09-26T00:00:00.000Z' })
    expect(stale.body).not.toContain('private-test-token')
    await request()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    vi.setSystemTime(new Date('2026-09-26T01:01:00Z'))
    const expired = await request()
    expect(expired.statusCode).toBe(503)
    expect(JSON.parse(expired.body)).toMatchObject({ state: 'unavailable', fetchedAt: null })
  })

  it('handles revoked credentials without exposing the upstream error', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private-test-token expired' } }), { status: 400 }))
    const result = await request()
    expect(result.statusCode).toBe(503)
    expect(result.body).not.toContain('private-test-token')
    expect(JSON.parse(result.body).state).toBe('unavailable')
  })

  it('invalidates cached data when credentials change', async () => {
    await request()
    vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'replacement')
    await request()
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
    expect(JSON.parse((await request()).body)).toMatchObject({ state: 'ready', followers: null })
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
