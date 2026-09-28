import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readProfileSnapshot, saveProfileSnapshot } from '../netlify/functions/lib/instagram-cache'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-storage-key' }
const snapshot = { username: 'sooyoungchoi', followers: 100, profileImage: 'https://scontent.cdninstagram.com/avatar.jpg', fetchedAt: '2026-09-26T00:00:00.000Z' }
const fetchMock = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T01:00:00Z'))
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify(snapshot)))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks() })

it('restores only the matching account and sanitizes the image URL', async () => {
  expect(await readProfileSnapshot(snapshot.username, env)).toEqual(snapshot)
  expect(await readProfileSnapshot('another_account', env)).toBeUndefined()
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...snapshot, profileImage: 'https://untrusted.example/avatar.jpg' })))
  expect(await readProfileSnapshot(snapshot.username, env)).toEqual({ ...snapshot, profileImage: '' })
})

it.each([
  { followers: -1 }, { followers: 1.5 }, { followers: '100' }, { followers: null },
  { fetchedAt: 'invalid' }, { fetchedAt: '2026-09-27T00:00:00Z' },
])('rejects invalid saved data: %j', async (overrides) => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...snapshot, ...overrides })))
  expect(await readProfileSnapshot(snapshot.username, env)).toBeUndefined()
})

it('keeps the last confirmed snapshot during a long outage with its original timestamp', async () => {
  vi.setSystemTime(new Date('2027-09-26T00:00:00Z'))
  expect(await readProfileSnapshot(snapshot.username, env)).toEqual(snapshot)
})

it('persists development snapshots on disk and never overwrites them with invalid counts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-cache-test-'))
  const localEnv = { INSTAGRAM_PROFILE_CACHE_DIR: directory }
  try {
    await saveProfileSnapshot(snapshot, localEnv)
    await saveProfileSnapshot({ ...snapshot, followers: -1 }, localEnv)
    expect(await readProfileSnapshot(snapshot.username, localEnv)).toEqual(snapshot)
    expect(await readProfileSnapshot('another_account', localEnv)).toBeUndefined()
    expect(await readProfileSnapshot('../outside', localEnv)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  } finally { await rm(directory, { recursive: true, force: true }) }
})

it('stores only public profile fields and keeps credentials in headers', async () => {
  await saveProfileSnapshot(snapshot, env)
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('https://example.supabase.co/storage/v1/object/blog-assets/instagram-profiles/sooyoungchoi.json')
  expect(init).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer private-storage-key', 'x-upsert': 'true' } })
  expect(JSON.parse(init.body)).toEqual(snapshot)
  expect(url + init.body).not.toContain('private-storage-key')
})

it('allows operation without storage configuration or during storage failures', async () => {
  expect(await readProfileSnapshot(snapshot.username, {})).toBeUndefined()
  await saveProfileSnapshot(snapshot, {})
  expect(fetchMock).not.toHaveBeenCalled()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  fetchMock.mockRejectedValue(new Error('offline'))
  expect(await readProfileSnapshot(snapshot.username, env)).toBeUndefined()
  await expect(saveProfileSnapshot(snapshot, env)).resolves.toBeUndefined()
  fetchMock.mockResolvedValue(new Response('{}', { status: 403 }))
  expect(await readProfileSnapshot(snapshot.username, env)).toBeUndefined()
  await expect(saveProfileSnapshot(snapshot, env)).resolves.toBeUndefined()
})
