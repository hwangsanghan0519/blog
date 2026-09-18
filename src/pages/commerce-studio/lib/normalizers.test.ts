import { describe, expect, it } from 'vitest'
import {
  normalizeAdBanners,
  normalizeCategories,
  normalizeHeroVideo,
  normalizePosts,
} from './normalizers'

describe('commerce data normalizers', () => {
  it('trims, compacts and de-duplicates category names without changing order', () => {
    expect(normalizeCategories(['  아이유 ', '아이유', '뉴진스   하니', null])).toEqual(['아이유', '뉴진스 하니'])
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
})
