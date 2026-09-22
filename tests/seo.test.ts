import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../netlify/functions/seo-page'
import { createSitemapXml } from '../netlify/functions/blog-data'
import { handler as robotsHandler } from '../netlify/functions/robots'
import { canonicalSiteOrigin, publicHttpUrl, readKrwPrice, seoTitle } from '../src/shared/lib/seo-config'
import { siteOrigin } from '../netlify/functions/lib/site-origin'

const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const product = {
  id: 'product-1', slug: 'test-product', status: 'published', title: '상품 제목 '.repeat(20), category: '테스트 셀럽',
  excerpt: '실제 상품 소개', coverImage: '/product.jpg',
  detailImages: ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg'],
  detailDescriptions: ['첫 번째 설명', '두 번째 설명', '<script>alert(1)</script>', '네 번째 설명'],
  productLinks: [{ href: 'https://shop.example/item', price: '12,900원', mall: '테스트몰' }, { href: 'https://shop.example/range', price: '10,000~20,000원' }],
}
const event = { httpMethod: 'GET', headers: { host: 'preview.example' }, queryStringParameters: { kind: 'product', value: product.slug } }
function mockResponses(data: unknown = product, status = 200, shellStatus = 200) {
  vi.stubEnv('VITE_SITE_URL', 'https://canonical.example')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/index.html')
    ? new Response(shell, { status: shellStatus })
    : new Response(JSON.stringify(data), { status })))
}
function graph(html: string) {
  return JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)![1])['@graph'] as Array<Record<string, any>>
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('SEO page responses', () => {
  it.each([
    { path: '/product/test-product', queryStringParameters: null },
    { path: '/.netlify/functions/seo-page/product/test-product', queryStringParameters: { utm_source: 'kakaotalk' } },
    { path: '/.netlify/functions/seo-page', rawUrl: 'https://ssenshop.co.kr/product/test-product', queryStringParameters: {} },
    { path: '/product/test-product/', queryStringParameters: { kind: 'category', value: 'wrong' } },
  ])('renders shared product paths without injected query parameters: %j', async (route) => {
    mockResponses()
    const result = await handler({ ...event, ...route })
    expect(result.statusCode).toBe(200)
    expect(result.body).toContain('https://canonical.example/product/test-product')
    expect(fetch).toHaveBeenCalledWith('https://preview.example/.netlify/functions/blog-data?post=test-product', expect.any(Object))
  })

  it('serves crawlable home links and decodes Korean celebrity paths once', async () => {
    mockResponses({ posts: [product, { ...product, slug: 'draft-secret', status: 'draft' }] })
    const home = await handler({ ...event, path: '/', queryStringParameters: null })
    expect(home.statusCode).toBe(200)
    expect(home.body).toContain('/product/test-product')
    expect(home.body).toContain(`/celeb/${encodeURIComponent(product.category)}`)
    expect(home.body).not.toContain('draft-secret')
    const category = await handler({ ...event, path: `/celeb/${encodeURIComponent(product.category)}`, queryStringParameters: null })
    expect(category.statusCode).toBe(200)
    expect(category.body).toContain('/product/test-product')
    const legacy = await handler({ ...event, path: '/', queryStringParameters: { category: product.category } })
    expect(legacy.body).toContain(`href="https://canonical.example/celeb/${encodeURIComponent(product.category)}"`)
  })

  it('serves one canonical, complete product details and truthful offers before JavaScript runs', async () => {
    mockResponses()
    const result = await handler(event)
    expect(result.statusCode).toBe(200)
    expect(result.body.match(/rel="canonical"/g)).toHaveLength(1)
    expect(result.body).toContain('href="https://canonical.example/product/test-product"')
    expect(result.body).toContain('name="site-origin" content="https://canonical.example"')
    expect(result.body).toContain('첫 번째 설명')
    expect(result.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(result.body).not.toContain('<noscript>')
    expect(result.body).not.toContain('https://ssenshop.netlify.app')
    const data = graph(result.body)
    expect(data.find((node) => node['@type'] === 'Product')?.offers.price).toBe(12900)
    expect(data.find((node) => node['@type'] === 'WebSite')?.alternateName).toBe('CELEB HOUSE')
    const title = result.body.match(/<title>(.*?)<\/title>/)![1]
    expect(title.length).toBeLessThanOrEqual(68)
    expect(title).toMatch(/셀럽하우스$/)
  })

  it('distinguishes missing products from temporary service failures', async () => {
    mockResponses({}, 404)
    expect((await handler(event)).statusCode).toBe(404)
    mockResponses({}, 500)
    const outage = await handler(event)
    expect(outage.statusCode).toBe(503)
    expect(outage.headers['retry-after']).toBe('300')
    mockResponses(product, 200, 500)
    expect((await handler(event)).statusCode).toBe(503)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('internal credentials must not leak')))
    const failed = await handler(event)
    expect(failed.statusCode).toBe(503)
    expect(failed.body).not.toContain('credentials')
  })

  it('does not index unpublished products and supports HEAD without a body', async () => {
    mockResponses({ ...product, status: 'draft' })
    const missing = await handler(event)
    expect(missing.statusCode).toBe(404)
    expect(missing.body).toContain('noindex,follow')
    expect(missing.body).not.toContain('rel="canonical"')
    mockResponses()
    const head = await handler({ ...event, httpMethod: 'HEAD' })
    expect(head.statusCode).toBe(200)
    expect(head.body).toBe('')
  })

  it('lists only published products on celebrity pages with correct links', async () => {
    mockResponses({ categories: [product.category], posts: [product, { ...product, slug: 'draft-secret', status: 'draft' }] })
    const page = await handler({ ...event, queryStringParameters: { kind: 'category', value: product.category } })
    expect(page.statusCode).toBe(200)
    expect(page.body).toContain('/product/test-product')
    expect(page.body).not.toContain('draft-secret')
    expect(graph(page.body).find((node) => node['@type'] === 'CollectionPage')?.mainEntity.numberOfItems).toBe(1)
  })
})

describe('SEO data correctness', () => {
  it('uses the custom primary domain even with an old Netlify URL or a preview host', async () => {
    vi.stubEnv('VITE_SITE_URL', '')
    vi.stubEnv('URL', 'https://ssenshop.netlify.app')
    expect(siteOrigin({ host: 'preview.netlify.app' })).toBe('https://ssenshop.co.kr')
    expect(canonicalSiteOrigin('https://www.ssenshop.co.kr')).toBe('https://ssenshop.co.kr')
    expect(canonicalSiteOrigin('https://ssenshop.netlify.app')).toBe('https://ssenshop.co.kr')
    const robots = await robotsHandler({ httpMethod: 'GET', headers: { host: 'preview.netlify.app' } })
    expect(robots.statusCode).toBe(200)
    expect(robots.body).toContain('Sitemap: https://ssenshop.co.kr/sitemap.xml')
    expect(robots.body).toContain('User-agent: *\nAllow: /')
    expect((await robotsHandler({ httpMethod: 'HEAD', headers: {} })).body).toBe('')
  })
  it('keeps brand names on long titles and rejects ambiguous prices or non-public URLs', () => {
    expect(seoTitle('긴 상품 '.repeat(100))).toMatch(/… \| 셀럽하우스$/)
    expect(readKrwPrice('₩ 12,900')).toBe(12900)
    for (const price of ['10,000~20,000원', '월 3,000원 x 12개월', '20% 할인 12,000원', '가격 문의', '12,34원']) expect(readKrwPrice(price)).toBeNull()
    expect(publicHttpUrl('data:image/svg+xml,anything', 'https://example.com')).toBe('')
    expect(publicHttpUrl('javascript:alert(1)', 'https://example.com')).toBe('')
  })

  it('deduplicates sitemap URLs, excludes drafts and omits invalid or future modification dates', () => {
    const sitemap = createSitemapXml({
      posts: [{ ...product, updatedAt: '2999-01-01' }, { ...product, updatedAt: 'invalid' }, { ...product, slug: 'draft-secret', status: 'draft' }],
      savedAt: '2026-01-01', categories: [product.category], adBanners: [], categoryImages: {}, heroVideo: null,
    }, 'https://canonical.example')
    expect(sitemap.match(/<loc>https:\/\/canonical.example\/product\/test-product<\/loc>/g)).toHaveLength(1)
    expect(sitemap).not.toContain('draft-secret')
    expect(sitemap).not.toContain('2999')
    expect(sitemap).not.toContain('invalid')
    expect(sitemap).toContain('<image:loc>https://canonical.example/product.jpg</image:loc>')
  })
})
