import { describe, expect, it } from 'vitest'
import { createProductSeoNodes, getProductBodyText, getProductImages, getProductSeo, getProductTags } from '../src/shared/lib/product-seo'

const origin = 'https://powerpuffceleb.co.kr'
const product = {
  id: 'coat-1', slug: 'on-and-on-coat', title: '수영 일본여행 야상', category: '수영',
  excerpt: '온앤온 하이넥 포켓 워크자켓 NEW6AM831_43', tags: ['온앤온', '#NEW6AM831_43', '가을 아우터'],
  coverImage: '/coat.jpg', detailImages: ['/coat-1.jpg', '/coat-2.jpg', '/coat-3.jpg', '/coat-4.jpg'],
  detailDescriptions: ['하이넥 디자인과 큼직한 포켓이 특징입니다.', '짧은 기장', '여유 있는 핏', '가을 아우터'],
  productLinks: [{ href: 'https://shop.example/coat', price: '285,050원', mall: '제휴몰' }],
  updatedAt: '2026-01-01T09:00:00Z',
}

describe('shared product SEO', () => {
  it('uses a single distinctive tag in a concise title without repeating the celebrity', () => {
    const seo = getProductSeo(product, origin)
    expect(seo.pageTitle).toBe('수영 일본여행 야상 · 온앤온 | 파워퍼프셀럽')
    expect(seo.description).toContain('NEW6AM831_43')
    expect(seo.description).toContain('하이넥 디자인과 큼직한 포켓')
    expect(seo.description).not.toMatch(/수영가|유튜브|광고|인스타그램/)
    expect(seo.description.length).toBeLessThanOrEqual(160)
  })

  it('adds a missing celebrity, skips tags already in the title and preserves the brand on long titles', () => {
    expect(getProductSeo({ ...product, title: '일본여행 야상', tags: ['일본여행 야상', '온앤온'] }, origin).pageTitle).toBe('수영 · 일본여행 야상 · 온앤온 | 파워퍼프셀럽')
    const title = getProductSeo({ ...product, title: '긴 상품 제목 '.repeat(30) }, origin).pageTitle
    expect(title.length).toBeLessThanOrEqual(68)
    expect(title).toMatch(/… \| 파워퍼프셀럽$/)
    expect(title).not.toContain('온앤온')
  })

  it('normalizes hashtags, Unicode, spacing and duplicate tags without altering the saved data', () => {
    const tags = [' #온앤온 ', '온앤온', '#ＦＩＬＡ', 'fila', ' 하이넥   야상 ', '', null, 42, 'x'.repeat(49)]
    expect(getProductTags(tags)).toEqual(['온앤온', 'FILA', '하이넥 야상'])
    expect(tags[0]).toBe(' #온앤온 ')
    expect(getProductTags(Array.from({ length: 30 }, (_, i) => `태그 ${i}`))).toHaveLength(12)
    expect(getProductTags(Array.from({ length: 30 }, (_, i) => `태그 ${i}`), Infinity)).toHaveLength(30)
  })

  it('extracts real text from both editor HTML and legacy Markdown', () => {
    const content = '<h2>소재 &amp; 핏</h2><p>부드러운 &#47732; 소재<br>여유 있는 핏</p><script>alert("secret")</script><style>body {display:none}</style>'
    expect(getProductBodyText({ content })).toBe('소재 & 핏\n부드러운 면 소재\n여유 있는 핏')
    expect(getProductBodyText({ content: '## 소재\n**면 100%**\n- 여유 있는 핏' })).toBe('소재\n면 100%\n여유 있는 핏')
    const seo = getProductSeo({ ...product, excerpt: '', detailImages: [], content }, origin)
    expect(seo.description).toContain('부드러운 면 소재')
    expect(seo.description).not.toMatch(/secret|display|<h2>/)
  })

  it('connects product, web page and breadcrumbs and exposes all five photos', () => {
    const nodes = createProductSeoNodes(product, origin)
    const item = nodes[0]
    const page = nodes[1]
    expect(item.image).toHaveLength(5)
    expect(item.offers).toMatchObject({ '@type': 'Offer', price: 285050, priceCurrency: 'KRW' })
    expect(page.keywords).toBe('온앤온, NEW6AM831_43, 가을 아우터')
    expect(page.dateModified).toBe('2026-01-01T09:00:00.000Z')
    expect(page.mainEntity).toEqual({ '@id': item['@id'] })
    expect(page.breadcrumb).toEqual({ '@id': nodes[2]['@id'] })
    expect(JSON.stringify(nodes)).not.toMatch(/aggregateRating|availability|priceValidUntil|"sku"/)
  })

  it('aggregates only valid public offers and never invents ratings, stock or prices', () => {
    const item = createProductSeoNodes({ ...product, productLinks: [
      ...product.productLinks,
      { href: 'https://other-shop.example/coat', price: '290,000원', mall: '다른 몰' },
      { href: 'https://shop.example/range', price: '20,000~30,000원' },
      { href: 'javascript:alert(1)', price: '100원' },
    ] }, origin)[0]
    expect(item.offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 285050, highPrice: 290000, offerCount: 2 })
    expect(createProductSeoNodes({ ...product, productLinks: [], updatedAt: '2999-01-01' }, origin)[0].offers).toBeUndefined()
    expect(createProductSeoNodes({ ...product, updatedAt: '2999-01-01' }, origin)[1].dateModified).toBeUndefined()
  })

  it('deduplicates public images and gives embedded uploads crawlable asset URLs', () => {
    const images = getProductImages({ ...product, detailImages: ['/coat.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA'] }, origin)
    expect(images).toHaveLength(2)
    expect(images[0]).toBe(`${origin}/coat.jpg`)
    const url = new URL(images[1])
    expect(url.searchParams.get('asset')).toBe('post-detail')
    expect(url.searchParams.get('id')).toBe('coat-1:2')
  })
})
