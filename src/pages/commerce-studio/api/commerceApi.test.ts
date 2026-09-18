import { describe, expect, it } from 'vitest'
import type { Post } from '../../../entities/post/model/types'
import { createCloudPatch, hasCloudPatchChanges } from './commerceApi'
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
