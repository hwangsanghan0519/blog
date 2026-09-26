import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../netlify/functions/blog-data'
const fetchMock = vi.fn()
const data = { adBanners: [], categories: ['셀럽'], categoryImages: {}, heroVideo: null, posts: [{ id: 'one', title: 'before' }] }
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'private-key')
  vi.stubEnv('BLOG_ADMIN_TOKEN', 'old-token')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockImplementation(async (_url, options) => options?.method === 'POST' ? new Response(null, { status: 201 }) : new Response(JSON.stringify([{ id: 'main', data }])))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('URL-only content writes', () => {
  it.each(['PATCH', 'PUT'])('saves %s without a token while retaining categories', async (httpMethod) => {
    const payload = httpMethod === 'PATCH' ? { postChanges: [{ id: 'one', patch: { title: 'after' } }] } : { ...data, posts: [{ id: 'one', title: 'after' }] }
    const result = await handler({ httpMethod, headers: {}, body: JSON.stringify(payload) })
    expect(result.statusCode).toBe(200)
    const writes = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')
    const rows = JSON.parse(writes.at(-1)![1].body)
    expect(rows[0].data.posts[0].title).toBe('after')
    expect(rows[0].data.categories).toEqual(['셀럽'])
    expect(rows[1].data.categories).toEqual(['셀럽'])
    expect(result.body).not.toContain('private-key')
  })
  it('validates patches without requiring authentication', async () => {
    const result = await handler({ httpMethod: 'PATCH', headers: {}, body: JSON.stringify({ categories: [7] }) })
    expect(result.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

 it('persists the admin roster in the main and public summary rows', async () => {
   const celebAccounts = [{ name: '수영', username: 'sooyoungchoi' }]
   const result = await handler({ httpMethod: 'PATCH', headers: {}, body: JSON.stringify({ celebAccounts }) })
   expect(result.statusCode).toBe(200)
   const writes = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')
   const rows = JSON.parse(writes.at(-1)![1].body)
   expect(rows[0].data.celebAccounts).toEqual(celebAccounts)
   expect(rows[1].data.celebAccounts).toEqual(celebAccounts)
 })
 it('allows clearing the roster without resurrecting defaults', async () => {
   const result = await handler({ httpMethod: 'PATCH', headers: {}, body: JSON.stringify({ celebAccounts: [] }) })
   expect(result.statusCode).toBe(200)
   const writes = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')
   expect(JSON.parse(writes.at(-1)![1].body)[0].data.celebAccounts).toEqual([])
 })
 it('rejects malformed usernames before writing content', async () => {
   expect((await handler({ httpMethod: 'PATCH', headers: {}, body: JSON.stringify({ celebAccounts: [{ name: 'x', username: 'x){id}' }] }) })).statusCode).toBe(400)
   expect(fetchMock).not.toHaveBeenCalled()
 })
