import { describe, expect, it } from 'vitest'
import {
  normalizeAdBanners,
  normalizeCategories,
  normalizeHeroVideo,
  normalizePosts,
  uniqueCategories,
} from './normalizers'

describe('commerce data normalizers', () => {
  it('trims, compacts and de-duplicates category names without changing order', () => {
    expect(normalizeCategories(['  아이유 ', '아이유', '뉴진스   하니', null])).toEqual(['아이유', '뉴진스 하니'])
  })

  it('keeps deleted category assignments empty after saving and reloading', () => {
    const posts = normalizePosts([
      { id: 'deleted-category', category: '' },
      { id: 'legacy-category', category: '분류 없음' },
      { id: 'compact-legacy-category', category: '분류없음' },
      { id: 'assigned-category', category: '아이유' },
    ], ['아이유'])
    const reloaded = normalizePosts(JSON.parse(JSON.stringify(posts)), ['아이유'])

    expect(reloaded.map((post) => post.category)).toEqual(['', '', '', '아이유'])
    expect(uniqueCategories(reloaded)).toEqual(['아이유'])
    expect(normalizeCategories(['분류 없음', '아이유', '분류없음'])).toEqual(['아이유'])
    expect(normalizePosts([{ id: 'new-product' }])[0].category).toBe('')
  })

  it('recovers a complete post contract from partial external data', () => {
    const [post] = normalizePosts([
      {
        id: 'product-1',
        title: '테스트 상품',
        category: '  아이유  ',
        detailImages: ['one'],
        detailDescriptions: ['설명'],
        productLinks: [{ id: 'mall-1', mall: '쿠팡', href: 'https://example.com' }],
        status: 'published',
      },
    ])

    expect(post).toMatchObject({
      id: 'product-1',
      title: '테스트 상품',
      category: '아이유',
      status: 'published',
    })
    expect(post.detailImages).toEqual(['one', '', '', ''])
    expect(post.detailDescriptions).toEqual(['설명', '', '', ''])
    expect(post.productLinks).toEqual([
      { id: 'mall-1', mall: '쿠팡', price: '', label: '', href: 'https://example.com', badge: '' },
    ])
  })

  it('keeps default media hidden and preserves the legacy video visibility behavior', () => {
    const [banner] = normalizeAdBanners([])

    expect(banner.enabled).toBe(false)
    expect(banner.image).toBe('')
    expect(normalizeHeroVideo({ youtubeUrl: 'https://youtu.be/abcdefghijk' }).enabled).toBe(true)
    expect(normalizeHeroVideo({ youtubeUrl: 'https://youtu.be/abcdefghijk', enabled: false, visibilityConfigured: true }).enabled).toBe(false)
  })

  it('refreshes the previous brand video title while preserving custom settings', () => {
    expect(normalizeHeroVideo({ title: ' CELEB HOUSE VIDEO PICK ' }).title).toBe('POWER PUFF CELEB VIDEO PICK')
    expect(normalizeHeroVideo({ title: ' VIOLE VIDEO PICK ' }).title).toBe('POWER PUFF CELEB VIDEO PICK')
    expect(normalizeHeroVideo({ title: '이번 주 추천 영상' }).title).toBe('이번 주 추천 영상')
    expect(normalizeHeroVideo({ title: '' }).title).toBe('')
  })
})
