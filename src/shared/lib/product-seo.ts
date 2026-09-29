import { normalizeEditorContent } from '../../entities/post/lib/content'
import { publicHttpUrl, readKrwPrice, seoTitle } from './seo-config'

/** Shared by the HTML response, React reader and admin preview. */
export type SeoProduct = {
  title?: unknown
  slug?: unknown
  id?: unknown
  category?: unknown
  excerpt?: unknown
  content?: unknown
  tags?: unknown
  coverImage?: unknown
  detailImages?: unknown
  detailDescriptions?: unknown
  productLinks?: unknown
  updatedAt?: unknown
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
const comparable = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '')
const shorten = (value: string, length: number) => value.length > length ? `${value.slice(0, length - 1).trim()}…` : value
const fashionProductPattern = /패션|착장|사복|코디|아우터|자켓|재킷|야상|코트|점퍼|가디건|니트|셔츠|블라우스|맨투맨|후드|팬츠|청바지|스커트|원피스|드레스|가방|백팩|숄더백|크로스백|토트백|신발|운동화|스니커즈|로퍼|부츠|샌들|모자|목걸이|귀걸이|팔찌|선글라스/i

/** Text extraction, not an HTML sanitizer: callers must render the result as text. */
export function productPlainText(value: unknown) {
  return text(value)
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity: string) => {
      if (entity.startsWith('#')) {
        const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ''
      }
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[entity.toLowerCase()]
    })
    .split('\n').map((line) => compact(line)).filter(Boolean).join('\n')
}

export function getProductTags(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item) => {
    const tag = compact(productPlainText(item)).replace(/^#+\s*/, '').normalize('NFKC')
    const key = comparable(tag)
    if (!tag || tag.length > 48 || seen.has(key)) return []
    seen.add(key)
    return [tag]
  }).slice(0, limit)
}

export function hasProductFourCut(product: SeoProduct) {
  return Array.from({ length: 4 }, (_, index) => (
    Array.isArray(product.detailImages) && text(product.detailImages[index])
    && Array.isArray(product.detailDescriptions) && text(product.detailDescriptions[index])
  )).every(Boolean)
}

export function getProductBodyText(product: SeoProduct) {
  return productPlainText(normalizeEditorContent(text(product.content)))
}

export function getProductImages(product: SeoProduct, origin: string) {
  return Array.from(new Set([
    getProductImageUrl(product, product.coverImage, origin),
    ...(Array.isArray(product.detailImages) ? product.detailImages.slice(0, 4).map((image, index) => getProductImageUrl(product, image, origin, index)) : []),
  ].filter(Boolean)))
}

export function getProductImageUrl(product: SeoProduct, value: unknown, origin: string, index?: number) {
  const source = text(value)
  const id = text(product.id) || text(product.slug)
  if (source.startsWith('data:image/') && id) {
    // Legacy uploads already have a public asset endpoint; don't expose data URLs to crawlers.
    const query = new URLSearchParams({
      asset: index === undefined ? 'post' : 'post-detail',
      id: index === undefined ? id : `${id}:${index}`,
      v: text(product.updatedAt) || 'latest',
    })
    return `${origin}/.netlify/functions/blog-data?${query}`
  }
  return publicHttpUrl(source, origin)
}

function getProductOffers(product: SeoProduct) {
  if (!Array.isArray(product.productLinks)) return []
  return product.productLinks.flatMap((value: unknown) => {
    if (!value || typeof value !== 'object') return []
    const link = value as Record<string, unknown>
    const url = publicHttpUrl(link.href)
    const price = readKrwPrice(link.price)
    if (!url || price === null) return []
    return [{
      '@type': 'Offer' as const, url, price, priceCurrency: 'KRW',
      seller: text(link.mall) ? { '@type': 'Organization', name: text(link.mall) } : undefined,
    }]
  })
}

export function getProductSeo(product: SeoProduct, origin: string) {
  const name = compact(productPlainText(product.title)) || '상품'
  const category = compact(productPlainText(product.category))
  const tags = getProductTags(product.tags)
  let subject = category && !comparable(name).includes(comparable(category)) ? `${category} · ${name}` : name
  // One distinctive tag is useful; a repeated list of search terms is not a title.
  const titleTag = tags.find((tag) => tag.length <= 24 && !comparable(subject).includes(comparable(tag)))
  if (titleTag && `${subject} · ${titleTag} | 파워퍼프셀럽`.length <= 68) subject += ` · ${titleTag}`

  const excerpt = compact(productPlainText(product.excerpt))
  // Preserve product-specific terms; add outfit context only when the saved copy supports it.
  const productCopy = [name, excerpt, ...tags].join(' ')
  const isFashion = fashionProductPattern.test(productCopy)
  const searchTerms = getProductTags([
    ...tags,
    ...(isFashion ? ['연예인 착장', '연예인 패션 정보', '셀럽 착장', '셀럽 패션 정보', ...(category ? [`${category} 착장`, `${category} 패션 정보`] : [])] : []),
    ...(isFashion && /사복/.test(productCopy) ? ['연예인 사복 패션', '셀럽 사복 패션'] : []),
    ...(isFashion && /아이돌/.test(productCopy) ? ['아이돌 착장', '아이돌 패션 정보', ...(/사복/.test(productCopy) ? ['아이돌 사복 패션'] : [])] : []),
    ...(isFashion && /배우/.test(productCopy) ? ['배우 착장', '배우 패션 정보', ...(/사복/.test(productCopy) ? ['배우 사복 패션'] : [])] : []),
  ], Infinity)
  const detail = hasProductFourCut(product)
    ? compact(productPlainText((product.detailDescriptions as unknown[])[0]))
    : compact(getProductBodyText(product))
  const lead = excerpt || name
  const detailText = detail && !comparable(lead).includes(comparable(detail)) ? detail : ''
  const summary = [category ? `${category} ${isFashion ? '착장 정보' : 'PICK'}.` : '', /[.!?。]$/.test(lead) ? lead : `${lead}.`, detailText || '상품 사진과 등록된 제휴몰 가격을 확인하세요.'].filter(Boolean).join(' ')
  const images = getProductImages(product, origin)
  const offers = getProductOffers(product)
  const updatedAt = Date.parse(text(product.updatedAt))
  return {
    name, category, tags, searchTerms, offers, images,
    canonical: `${origin}/product/${encodeURIComponent(text(product.slug) || text(product.id))}`,
    pageTitle: seoTitle(subject),
    description: shorten(summary, 160),
    keywords: Array.from(new Set([name, category, ...searchTerms].filter(Boolean))).join(', '),
    image: images[0] || `${origin}/powerpuffceleb-og.png`,
    productPrice: offers.length ? Math.min(...offers.map((offer) => offer.price)) : undefined,
    dateModified: Number.isFinite(updatedAt) && updatedAt <= Date.now() ? new Date(updatedAt).toISOString() : undefined,
  }
}

export function createProductSeoNodes(product: SeoProduct, origin: string) {
  const seo = getProductSeo(product, origin)
  const { canonical, offers } = seo
  const breadcrumbs = [
    { name: '홈', url: `${origin}/` },
    ...(seo.category ? [{ name: seo.category, url: `${origin}/celeb/${encodeURIComponent(seo.category)}` }] : []),
    { name: seo.name, url: canonical },
  ]
  return [
    {
      '@type': 'Product', '@id': `${canonical}#product`, name: seo.name,
      description: seo.description, url: canonical,
      image: seo.images.length ? seo.images : undefined,
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      offers: offers.length > 1 ? {
        '@type': 'AggregateOffer', priceCurrency: 'KRW', lowPrice: seo.productPrice,
        highPrice: Math.max(...offers.map((offer) => offer.price)), offerCount: offers.length, offers,
      } : offers[0],
    },
    {
      '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical,
      name: seo.pageTitle, description: seo.description, inLanguage: 'ko-KR',
      keywords: seo.searchTerms.length ? seo.searchTerms.join(', ') : undefined,
      dateModified: seo.dateModified,
      isPartOf: { '@id': `${origin}/#website` },
      mainEntity: { '@id': `${canonical}#product` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
      primaryImageOfPage: seo.images.length ? { '@type': 'ImageObject', url: seo.image } : undefined,
    },
    {
      '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.name, item: item.url,
      })),
    },
  ]
}
