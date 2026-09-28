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

it('stops repeated requests across the roster after server authentication fails, then recovers', async () => {
  const { fetchCelebStories } = await import('../src/pages/commerce-studio/api/celebStoryApi')
  const signal = new AbortController().signal
  await fetchCelebStories('sooyoungchoi', signal)
  for (let minute = 0; minute < 5; minute++) {
    vi.setSystemTime(new Date(`2026-09-28T00:0${minute}:00Z`))
    const result = await fetchCelebStories('jennierubyjane', signal)
    expect(result).toMatchObject({ account: accounts[1], followers: null, issue: 'authentication' })
    await fetchCelebStories('sooyoungchoi', signal)
  }
  expect(fetchMock).toHaveBeenCalledTimes(1)
  vi.setSystemTime(new Date('2026-09-28T00:05:00Z'))
  fetchMock.mockImplementation(async () => json({ ...failed, state: 'ready', issue: undefined, followers: 100 }))
  expect(await fetchCelebStories('sooyoungchoi', signal)).toMatchObject({ state: 'ready', followers: 100 })
  await fetchCelebStories('jennierubyjane', signal)
  expect(fetchMock).toHaveBeenCalledTimes(3)
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
