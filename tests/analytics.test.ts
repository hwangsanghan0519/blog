import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../src/entities/post/model/types'

const product = { id: 'product-1', title: '테스트 상품', category: '셀럽' } as Post
const link = { id: 'mall-1', mall: '테스트몰', href: 'https://mall.example/?secret=affiliate' } as Post['productLinks'][number]
let append: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123')
  vi.stubEnv('VITE_GA_DEBUG', 'false')
  vi.stubEnv('VITE_SITE_URL', 'https://powerpuffceleb.co.kr')
  vi.stubEnv('DEV', false)
  vi.stubGlobal('window', { location: { pathname: '/', hostname: 'powerpuffceleb.co.kr' } })
  append = vi.fn()
  vi.stubGlobal('document', { createElement: () => ({}), head: { append } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function queue() { return (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>)) }

describe('GA4 measurement', () => {
  it('initializes once through remounts and leaves pageviews to GA4 enhanced measurement', async () => {
    const { initializeAnalytics } = await import('../src/shared/lib/analytics')
    initializeAnalytics()
    initializeAnalytics()
    expect(append).toHaveBeenCalledTimes(1)
    expect(append.mock.calls[0][0]).toMatchObject({ async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST123' })
    expect(queue().map((entry) => entry[0])).toEqual(['js', 'config'])
    expect(queue()[1][2]).not.toHaveProperty('send_page_view', false)
  })

  it.each(['/secret/sanghan', '/blog/secret/sanghan'])('does not measure admin route %s', async (pathname) => {
    window.location.pathname = pathname
    const { trackProductClick } = await import('../src/shared/lib/analytics')
    trackProductClick(product)
    expect(append).not.toHaveBeenCalled()
    expect(queue()).toEqual([])
  })

  it.each(['localhost', '127.0.0.1', 'deploy-preview-42.netlify.app'])('excludes development and preview host %s', async (hostname) => {
    window.location.hostname = hostname
    const { initializeAnalytics } = await import('../src/shared/lib/analytics')
    expect(initializeAnalytics()).toBe(false)
  })

  it.each(['', 'G-<script>', 'UA-1234'])('ignores missing or invalid measurement ID %s', async (id) => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', id)
    const { initializeAnalytics } = await import('../src/shared/lib/analytics')
    expect(initializeAnalytics()).toBe(false)
    expect(append).not.toHaveBeenCalled()
  })

  it('sends distinct standard item clicks/views and affiliate clicks without link secrets', async () => {
    const { trackProductClick, trackProductView, trackAffiliateClick } = await import('../src/shared/lib/analytics')
    trackProductClick(product, 'search')
    trackProductView(product)
    trackAffiliateClick(product, link)
    const events = queue().filter((entry) => entry[0] === 'event')
    expect(events.map((entry) => entry[1])).toEqual(['select_item', 'view_item', 'affiliate_click'])
    expect(events[0][2]).toEqual({ item_list_id: 'search', item_list_name: 'search', items: [{ item_id: 'product-1', item_name: '테스트 상품', item_category: '셀럽', quantity: 1 }] })
    expect(JSON.stringify(events[2])).not.toContain('secret')
  })

  it('allows explicit DebugView testing on localhost and tolerates blocked analytics', async () => {
    window.location.hostname = 'localhost'
    vi.stubEnv('VITE_GA_DEBUG', 'true')
    const { trackProductClick } = await import('../src/shared/lib/analytics')
    trackProductClick(product)
    expect(queue()[1][2]).toHaveProperty('debug_mode', true)
    window.gtag = () => { throw new Error('blocked') }
    expect(() => trackProductClick(product)).not.toThrow()
  })
})
