import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { exchangeToken, updateTokenEnvironment } from '../scripts/extend-instagram-token.mjs'

const env = { INSTAGRAM_ACCESS_TOKEN: 'short-private', INSTAGRAM_USER_ID: '123', META_APP_ID: '456', META_APP_SECRET: 'secret-private' }
const fetchMock = vi.fn()
const scopes = ['instagram_basic', 'instagram_manage_insights', 'pages_read_engagement']
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-29T00:00:00Z'))
  fetchMock.mockReset().mockImplementation(async (url: URL) => {
    if (url.pathname.endsWith('/debug_token')) return json({ data: { is_valid: true, app_id: '456', type: 'USER', scopes, expires_at: Date.now() / 1000 + 60 * 86400 } })
    if (url.pathname.endsWith('/oauth/access_token')) return json({ access_token: 'long-private' })
    return json({ business_discovery: { username: 'sooyoungchoi', followers_count: 100 } })
  })
})
afterEach(() => vi.useRealTimers())

it('verifies the app, scopes, expiry and an actual profile before accepting the token', async () => {
  const result = await exchangeToken(env, fetchMock)
  expect(result).toMatchObject({ token: 'long-private', expiresAt: '2026-11-28T00:00:00.000Z' })
  expect(fetchMock).toHaveBeenCalledTimes(4)
  expect(fetchMock.mock.calls[3][1].headers.authorization).toBe('Bearer long-private')
})

it('rejects an expired token without attempting an exchange or exposing secrets', async () => {
  fetchMock.mockResolvedValue(json({ error: { code: 190, message: 'short-private secret-private' } }, 400))
  await expect(exchangeToken(env, fetchMock)).rejects.toThrow('만료되거나 무효화')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([
  { app_id: 'other' }, { is_valid: false }, { type: 'PAGE' }, { scopes: [] },
])('rejects incompatible token metadata: %j', async (override) => {
  fetchMock.mockResolvedValue(json({ data: { is_valid: true, app_id: '456', type: 'USER', scopes, ...override } }))
  await expect(exchangeToken(env, fetchMock)).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('does not save a token that still cannot retrieve followers', async () => {
  const defaultFetch = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((url: URL) => url.pathname.endsWith('/123') ? json({ business_discovery: { username: 'sooyoungchoi' } }) : defaultFetch(url))
  await expect(exchangeToken(env, fetchMock)).rejects.toThrow('팔로워 수를 확인하지 못했습니다')
})

it('updates only token fields while retaining other environment settings', () => {
  const result = updateTokenEnvironment('# settings\nINSTAGRAM_ACCESS_TOKEN=old\nOTHER=value\n', { token: 'new', expiresAt: '2026-11-28T00:00:00Z' })
  expect(result).toContain('INSTAGRAM_ACCESS_TOKEN="new"')
  expect(result).toContain('INSTAGRAM_TOKEN_EXPIRES_AT="2026-11-28T00:00:00Z"')
  expect(result).toContain('OTHER=value')
  expect(result).not.toContain('=old')
})
