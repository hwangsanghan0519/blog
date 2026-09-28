import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const accounts = [{ name: '수영', username: 'sooyoungchoi' }, { name: '제니', username: 'jennierubyjane' }]
const failed = { accounts, account: accounts[0], followers: null, profileImage: '', fetchedAt: null, state: 'unavailable', issue: 'authentication' }
const fetchMock = vi.fn()
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-28T00:00:00Z'))
  fetchMock.mockReset().mockImplementation(async () => json(failed, 503))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('loads each account snapshot once during authentication failure, then recovers', async () => {
  fetchMock.mockImplementation(async (url) => String(url).includes('jennierubyjane')
    ? json({ ...failed, account: accounts[1], state: 'stale', followers: 200, fetchedAt: '2026-09-27T23:00:00Z' })
    : json(failed, 503))
  const { fetchCelebStories } = await import('../src/pages/commerce-studio/api/celebStoryApi')
  const signal = new AbortController().signal
  await fetchCelebStories('sooyoungchoi', signal)
  for (let minute = 0; minute < 5; minute++) {
    vi.setSystemTime(new Date(`2026-09-28T00:0${minute}:00Z`))
    const result = await fetchCelebStories('jennierubyjane', signal)
    expect(result).toMatchObject({ account: accounts[1], state: 'stale', followers: 200, issue: 'authentication' })
    await fetchCelebStories('sooyoungchoi', signal)
  }
  expect(fetchMock).toHaveBeenCalledTimes(2)
  vi.setSystemTime(new Date('2026-09-28T00:05:00Z'))
  fetchMock.mockImplementation(async () => json({ ...failed, state: 'ready', issue: undefined, followers: 100 }))
  expect(await fetchCelebStories('sooyoungchoi', signal)).toMatchObject({ state: 'ready', followers: 100 })
  await fetchCelebStories('jennierubyjane', signal)
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it('does not spread an account-specific upstream failure to other accounts', async () => {
  fetchMock.mockImplementation(async () => json({ ...failed, issue: 'upstream' }, 503))
  const { fetchCelebStories } = await import('../src/pages/commerce-studio/api/celebStoryApi')
  await fetchCelebStories('sooyoungchoi', new AbortController().signal)
  await fetchCelebStories('jennierubyjane', new AbortController().signal)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('honors cancellation even when authentication failure is cached', async () => {
  const { fetchCelebStories } = await import('../src/pages/commerce-studio/api/celebStoryApi')
  await fetchCelebStories('sooyoungchoi', new AbortController().signal)
  const controller = new AbortController()
  controller.abort()
  await expect(fetchCelebStories('jennierubyjane', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
