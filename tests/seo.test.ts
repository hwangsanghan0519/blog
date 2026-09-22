import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handler } from '../netlify/functions/seo-page'
import { createSitemapXml } from '../netlify/functions/blog-data'
import { handler as robotsHandler } from '../netlify/functions/robots'
import { canonicalSiteOrigin, publicHttpUrl, readKrwPrice, seoTitle } from '../src/shared/lib/seo-config'
import { siteOrigin } from '../netlify/functions/lib/site-origin'
import { getProductShareUrl } from '../src/shared/lib/seo'
import { PRODUCTION_CLOUD_DATA_ENDPOINT } from '../src/pages/commerce-studio/model/config'
import { createProductSeoNodes, getProductSeo } from '../src/shared/lib/product-seo'

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
  it('uses the shared preview metadata and renders registered tags in crawlable product HTML', async () => {
    const taggedProduct = { ...product, title: '수영 일본여행 야상', category: '수영', tags: ['#온앤온', 'NEW6AM831_43', '온앤온'], updatedAt: '2026-01-01' }
    mockResponses(taggedProduct)
    const page = await handler(event)
    const seo = getProductSeo(taggedProduct, 'https://canonical.example')
    expect(page.body).toContain(`<title>${seo.pageTitle}</title>`)
    expect(page.body).toContain(`name="description" content="${seo.description}"`)
    expect(page.body).toContain('<ul class="seo-product-tags"><li>#온앤온</li><li>#NEW6AM831_43</li></ul>')
    expect(page.body.match(/<h1>/g)).toHaveLength(1)
    expect(graph(page.body).slice(2)).toEqual(JSON.parse(JSON.stringify(createProductSeoNodes(taggedProduct, 'https://canonical.example'))))
  })

  it('includes editor body text when four-cut content is incomplete without injecting HTML', async () => {
    mockResponses({ ...product, detailImages: [], content: '<h2>소재와 핏</h2><p>면 100% &amp; 여유 있는 핏</p><script>unsafe()</script>', tags: ['할인 $& $$', '&lt;img src=x onerror=alert(1)&gt;'] })
    const page = await handler(event)
    expect(page.body).toContain('<h2>상품 상세</h2><p>소재와 핏</p><p>면 100% &amp; 여유 있는 핏</p>')
    expect(page.body).toContain('#할인 $&amp; $$')
    expect(page.body).not.toContain('unsafe()')
    expect(page.body).not.toContain('<img src=x')
    expect(page.body.match(/id="root"/g)).toHaveLength(1)
    expect(() => graph(page.body)).not.toThrow()
  })

  it('keeps legacy image uploads accessible through public asset URLs', async () => {
    mockResponses({ ...product, coverImage: 'data:image/png;base64,AAAA', detailImages: Array(4).fill('data:image/png;base64,AAAA') })
    const page = await handler(event)
    const item = graph(page.body).find((node) => node['@type'] === 'Product')
    expect(item?.image).toHaveLength(5)
    expect(page.body).toContain('asset=post-detail&amp;id=product-1%3A0')
    expect(page.body).not.toContain('data:image/png')
  })

  it.each(['/', '/product/test-product', `/celeb/${encodeURIComponent(product.category)}`])(
    'keeps the initial loader outside the crawlable React root for %s', async (path) => {
      mockResponses(path.startsWith('/product/') ? product : { posts: [product] })
      const result = await handler({ ...event, path, queryStringParameters: null })
      const rootStart = result.body.indexOf('<div id="root">')
      expect(result.statusCode).toBe(200)
      expect(result.body.slice(0, rootStart)).toContain('<div id="app-boot"')
      expect(result.body.slice(rootStart)).toContain('class="seo-fallback')
      expect(result.body.slice(rootStart)).not.toContain('id="app-boot"')
      expect(result.body).toContain("window.addEventListener('storefront-ready'")
    },
  )

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
    expect(data.find((node) => node['@type'] === 'WebSite')?.alternateName).toBe('POWER PUFF CELEB')
    expect(data.find((node) => node['@type'] === 'Organization')?.name).toBe('파워퍼프셀럽')
    expect(data.find((node) => node['@type'] === 'Organization')?.logo).toBe('https://canonical.example/powerpuffceleb-logo.svg')
    expect(result.body).toContain('data-powerpuffceleb-seo')
    expect(result.body).toContain('type="image/png" sizes="96x96" href="/favicon-96x96.png"')
    expect(result.body).toContain('type="image/x-icon" sizes="32x32 48x48" href="/favicon.ico"')
    expect(result.body).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"')
    expect(result.body).not.toMatch(/셀럽하우스|CELEB HOUSE|celeb-house/)
    const title = result.body.match(/<title>(.*?)<\/title>/)![1]
    expect(title.length).toBeLessThanOrEqual(68)
    expect(title).toMatch(/파워퍼프셀럽$/)
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
    expect(siteOrigin({ host: 'preview.netlify.app' })).toBe('https://powerpuffceleb.co.kr')
    expect(canonicalSiteOrigin('https://www.ssenshop.co.kr')).toBe('https://powerpuffceleb.co.kr')
    expect(canonicalSiteOrigin('https://ssenshop.netlify.app')).toBe('https://powerpuffceleb.co.kr')
    const robots = await robotsHandler({ httpMethod: 'GET', headers: { host: 'preview.netlify.app' } })
    expect(robots.statusCode).toBe(200)
    expect(robots.body).toContain('Sitemap: https://powerpuffceleb.co.kr/sitemap.xml')
    expect(robots.body).toContain('User-agent: *\nAllow: /')
    expect((await robotsHandler({ httpMethod: 'HEAD', headers: {} })).body).toBe('')
  })
  it.each([
    'http://powerpuffceleb.co.kr', 'http://www.powerpuffceleb.co.kr', 'https://www.powerpuffceleb.co.kr',
    'http://ssenshop.co.kr', 'https://ssenshop.co.kr', 'http://www.ssenshop.co.kr', 'https://www.ssenshop.co.kr',
    'http://ssenshop.netlify.app', 'https://ssenshop.netlify.app',
  ])('migrates configured origins, metadata, shares and redirects from %s', async (oldOrigin) => {
    mockResponses()
    vi.stubEnv('VITE_SITE_URL', oldOrigin)
    vi.stubGlobal('document', { head: { querySelector: () => ({ content: oldOrigin }) } })
    expect(canonicalSiteOrigin(oldOrigin)).toBe('https://powerpuffceleb.co.kr')
    expect(getProductShareUrl('sw4xb354-03')).toBe('https://powerpuffceleb.co.kr/product/sw4xb354-03')
    expect(PRODUCTION_CLOUD_DATA_ENDPOINT).toBe('https://powerpuffceleb.co.kr/.netlify/functions/blog-data')
    const page = await handler(event)
    expect(page.body).toContain('href="https://powerpuffceleb.co.kr/product/test-product"')
    expect(graph(page.body).find((node) => node['@type'] === 'Product')?.url).toBe('https://powerpuffceleb.co.kr/product/test-product')
    expect(page.body).not.toMatch(/ssenshop\.(?:co\.kr|netlify\.app)|www\.powerpuffceleb\.co\.kr/)
    const robots = await robotsHandler({ httpMethod: 'GET', headers: {} })
    expect(robots.body).toContain('Sitemap: https://powerpuffceleb.co.kr/sitemap.xml')
    const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8')
    const rule = config.split('[[redirects]]').find((block) => block.includes(`from = "${oldOrigin}/*"`))
    expect(rule).toContain('to = "https://powerpuffceleb.co.kr/:splat"')
    expect(rule).toContain('status = 301')
    expect(rule).toContain('force = true')
    expect(config.indexOf(`from = "${oldOrigin}/*"`)).toBeLessThan(config.indexOf('from = "/product/:slug"'))
  })

  it('publishes the new domain throughout the default HTML, home, category and sitemap', async () => {
    mockResponses({ posts: [product], categories: [product.category] })
    vi.stubEnv('VITE_SITE_URL', 'https://ssenshop.co.kr')
    expect(shell).not.toContain('ssenshop.')
    expect(shell).toContain('rel="canonical" href="https://powerpuffceleb.co.kr/"')
    for (const path of ['/', `/celeb/${encodeURIComponent(product.category)}`]) {
      const page = await handler({ ...event, path, queryStringParameters: null })
      expect(page.statusCode).toBe(200)
      expect(page.body).toContain(`href="https://powerpuffceleb.co.kr${path}"`)
      expect(page.body).not.toContain('ssenshop.')
    }
    const sitemap = createSitemapXml({ posts: [product], savedAt: '', categories: [product.category], adBanners: [], categoryImages: {}, heroVideo: null }, siteOrigin({}))
    expect(sitemap).toContain('<loc>https://powerpuffceleb.co.kr/product/test-product</loc>')
    expect(sitemap).toContain('<image:loc>https://powerpuffceleb.co.kr/product.jpg</image:loc>')
    expect(sitemap).not.toContain('ssenshop.')
  })
  it('keeps brand names on long titles and rejects ambiguous prices or non-public URLs', () => {
    expect(seoTitle('긴 상품 '.repeat(100))).toMatch(/… \| 파워퍼프셀럽$/)
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
    for (const image of ['1.jpg', '2.jpg', '3.jpg', '4.jpg']) expect(sitemap).toContain(`<image:loc>https://canonical.example/${image}</image:loc>`)
    expect(sitemap.match(/<image:image>/g)).toHaveLength(5)
  })
})
