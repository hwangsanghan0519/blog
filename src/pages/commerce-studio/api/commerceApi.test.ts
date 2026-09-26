import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../../../entities/post/model/types'
import { createCloudPatch, hasCloudPatchChanges, queueCloudPatch, saveCloudData } from './commerceApi'
import type { CloudCommerceSnapshot } from '../model/types'

const post: Post = {
  id: 'product-1',
  title: '상품',
  slug: 'product',
  excerpt: '',
  category: '셀럽',
  tags: [],
  content: '<p>내용</p>',
  coverImage: '',
  detailImages: ['', '', '', ''],
  detailDescriptions: ['', '', '', ''],
  purchaseTitle: '구매하기',
  productLinks: [],
  status: 'draft',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const snapshot = (posts: Post[]): CloudCommerceSnapshot => ({
  adBanners: [],
  categories: ['셀럽'],
  categoryImages: {},
  heroVideo: {
    enabled: false,
    visibilityConfigured: false,
    youtubeUrl: '',
    eyebrow: '',
    title: '',
    stickerImage: '',
    stickerHref: '',
  },
  posts,
})

describe('mobile cloud saves', () => {
  const fetchMock = vi.fn()
  const patch = { postChanges: [{ id: post.id, patch: { title: '수정 상품' } }] }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { location: { hostname: 'powerpuffceleb.co.kr' } })
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockResolvedValue(new Response('{}', { status: 200 }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('saves an incomplete draft without AbortSignal.timeout support', async () => {
    vi.stubGlobal('AbortSignal', {})
    expect(await queueCloudPatch(patch, snapshot([post]))).toEqual({ saved: true })
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'PATCH', body: JSON.stringify(patch),
    }))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not report a failed save when cross-tab messaging is blocked', async () => {
    vi.stubGlobal('window', { location: { hostname: 'powerpuffceleb.co.kr' }, BroadcastChannel: true })
    vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('blocked') } })
    expect(await queueCloudPatch(patch, snapshot([post]))).toEqual({ saved: true })
  })

  it('falls back to PUT on an older server without timeout support', async () => {
    vi.stubGlobal('AbortSignal', {})
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 405 }))
    expect(await queueCloudPatch(patch, snapshot([post]))).toEqual({ saved: true })
    expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(['PATCH', 'PUT'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    [413, '이미지 용량 초과'], [400, '저장 데이터 확인 필요'], [403, '접근 권한 확인 필요'], [500, '서버 오류 500'],
  ])('distinguishes HTTP %s failures', async (status, message) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: status as number }))
    expect(await queueCloudPatch(patch, snapshot([post]))).toEqual({ saved: false, message: `저장 실패 · ${message}` })
  })

  it('times out a stalled request and lets the next save proceed', async () => {
    fetchMock.mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const stalled = queueCloudPatch(patch, snapshot([post]))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(await stalled).toEqual({ saved: false, message: '저장 실패 · 응답 시간 초과' })
    expect(await queueCloudPatch(patch, snapshot([post]))).toEqual({ saved: true })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports a connection failure and permits retry', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await saveCloudData(snapshot([post]))).toEqual({ saved: false, message: '저장 실패 · 네트워크 연결 확인' })
    expect(await queueCloudPatch(patch, snapshot([post]))).toEqual({ saved: true })
  })

  it('keeps edits ordered while a previous request is pending', async () => {
    let finish: (value: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve }))
    const first = queueCloudPatch(patch, snapshot([post]))
    const nextPatch = { postChanges: [{ id: post.id, patch: { title: '마지막 수정' } }] }
    const second = queueCloudPatch(nextPatch, snapshot([post]))
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    finish(new Response('{}'))
    expect(await first).toEqual({ saved: true })
    expect(await second).toEqual({ saved: true })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(nextPatch)
  })
})

describe('commerce cloud patch', () => {
  it('sends only changed post fields', () => {
    const previous = snapshot([post])
    const next = snapshot([{ ...post, title: '수정 상품', status: 'published' }])
    const patch = createCloudPatch(previous, next)

    expect(patch.postChanges).toEqual([
      { id: 'product-1', patch: { title: '수정 상품', status: 'published' } },
    ])
    expect(patch.deletedPostIds).toBeUndefined()
    expect(hasCloudPatchChanges(patch)).toBe(true)
  })

  it('tracks deleted products and leaves identical snapshots empty', () => {
    expect(createCloudPatch(snapshot([post]), snapshot([])).deletedPostIds).toEqual(['product-1'])

    const current = snapshot([post])
    expect(createCloudPatch(current, current)).toEqual({})
  })
})
