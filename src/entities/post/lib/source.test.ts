import { describe, expect, it } from 'vitest'
import { normalizeProductSource, productSourceLink, PRODUCT_SOURCE_LABELS } from './source'
import { normalizePosts } from '../../../pages/commerce-studio/lib/normalizers'
import { createCloudPatch } from '../../../pages/commerce-studio/api/commerceApi'
import { createEmptyPost } from '../model/factory'

describe('single product source', () => {
  it('supports each requested type with one safe destination', () => {
    expect(Object.values(PRODUCT_SOURCE_LABELS)).toEqual(['유튜브', '인스타', '일상', '브랜드', '방송', '드라마', '예능'])
    for (const [type, label] of Object.entries(PRODUCT_SOURCE_LABELS)) {
      expect(productSourceLink({ type, url: ' https://example.com/watch ' })).toMatchObject({ label, href: 'https://example.com/watch' })
    }
  })
  it('rejects multiple sources, unknown types and unsafe URLs', () => {
    expect(normalizeProductSource([{ type: 'youtube', url: 'https://example.com' }])).toBeNull()
    expect(normalizeProductSource({ type: 'unknown', url: 'https://example.com' })).toBeNull()
    for (const url of ['javascript:alert(1)', 'data:text/html,anything', '', 'not a url']) {
      expect(productSourceLink({ type: 'youtube', url })).toBeNull()
    }
  })
  it('keeps source fields through loading and serializes removal in cloud patches', () => {
    const [post] = normalizePosts([{ ...createEmptyPost(), source: { type: 'drama', url: 'https://example.com/episode' } }])
    expect(post.source).toEqual({ type: 'drama', url: 'https://example.com/episode' })
    const snapshot = { posts: [post], categories: [], categoryImages: {}, adBanners: [], heroVideo: { enabled: false, visibilityConfigured: false, youtubeUrl: '', eyebrow: '', title: '', stickerImage: '', stickerHref: '' } }
    const patch = createCloudPatch(snapshot, { ...snapshot, posts: [{ ...post, source: null }] })
    expect(JSON.parse(JSON.stringify(patch)).postChanges[0].patch.source).toBeNull()
    expect(normalizePosts([{ id: 'legacy' }])[0].source).toBeNull()
  })
})
