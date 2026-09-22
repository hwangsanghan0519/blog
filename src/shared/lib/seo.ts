import type { Post, ProductLink } from '../../entities/post/model/types'

import { SEO_SITE_NAME, SEO_HOME_TITLE, SEO_HOME_DESCRIPTION, canonicalSiteOrigin, seoTitle, publicHttpUrl, readKrwPrice } from './seo-config'
export { SEO_SITE_NAME, SEO_HOME_TITLE, SEO_HOME_DESCRIPTION } from './seo-config'

type SeoState = {
  category: string
  posts: Post[]
  selectedPost?: Post
}

export function applyPublicSeo({ category, posts, selectedPost }: SeoState) {
  // The public storefront can also render behind the admin sign-in flow.
  if (/^\/(?:blog\/)?secret(?:\/|$)/.test(window.location.pathname)) return
  const route = readSeoRoute(window.location.pathname)
  // Preserve the server's detail metadata until URL-driven React state has caught up.
  if (route.product && route.product !== selectedPost?.slug && route.product !== selectedPost?.id) return
  if (route.category && route.category !== category) return
  const origin = getPublicSiteOrigin()
  const isCategory = !selectedPost && category !== 'all'
  const canonicalPath = selectedPost
    ? getProductPath(selectedPost.slug || selectedPost.id)
    : isCategory
      ? getCategoryPath(category)
      : '/'
  const canonicalUrl = new URL(canonicalPath, origin).href
  const title = selectedPost
    ? seoTitle(`${selectedPost.title} | ${selectedPost.category} 착용·광고 핫템`)
    : isCategory
      ? seoTitle(`${category} 착용·광고 상품, 인스타·유튜브 핫템`)
      : SEO_HOME_TITLE
  const description = selectedPost
    ? truncate(
        `${selectedPost.category}가 유튜브·인스타그램에서 소개하거나 착용한 ${selectedPost.title}. ${selectedPost.excerpt || '등록된 제휴몰 가격과 제휴 링크를 확인하세요.'}`,
        160,
      )
    : isCategory
      ? `${category}가 유튜브와 인스타그램에서 착용·소개·광고한 상품을 모았습니다. 화제의 핫템과 잇템, 등록된 제휴몰 최저가를 파워퍼프셀럽에서 확인하세요.`
      : SEO_HOME_DESCRIPTION
  const categoryImage = isCategory ? posts.find((post) => post.status === 'published' && post.category === category && publicHttpUrl(post.coverImage, origin))?.coverImage : ''
  const image = publicHttpUrl(selectedPost?.coverImage || categoryImage, origin) || `${origin}/powerpuffceleb-og.png`
  const keywords = Array.from(new Set([
    ...(selectedPost ? [selectedPost.title, selectedPost.category, ...selectedPost.tags] : []),
    ...(isCategory ? [category] : posts.slice(0, 12).map((post) => post.category)),
    '연예인 핫템',
    '인플루언서 핫템',
    '연예인 착용 상품',
    '인스타 광고 상품',
    '유튜브 소개 상품',
    '셀럽 잇템',
    '최저가',
  ])).join(', ')

  document.title = title
  setMeta('name', 'description', description)
  setMeta('name', 'keywords', keywords)
  setMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
  setMeta('name', 'googlebot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
  setMeta('property', 'og:locale', 'ko_KR')
  setMeta('property', 'og:site_name', SEO_SITE_NAME)
  setMeta('property', 'og:type', selectedPost ? 'product' : 'website')
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', canonicalUrl)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:secure_url', image)
  setMeta('property', 'og:image:alt', selectedPost ? `${selectedPost.title} 상품 이미지` : '파워퍼프셀럽 연예인 인플루언서 핫템 큐레이션')
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', image)
  for (const key of ['og:image:width', 'og:image:height']) removeMeta('property', key)
  if (image === `${origin}/powerpuffceleb-og.png`) {
    setMeta('property', 'og:image:width', '1200')
    setMeta('property', 'og:image:height', '630')
  }
  const lowestPrice = selectedPost ? readLowestPrice(selectedPost.productLinks) : null
  if (lowestPrice) {
    setMeta('property', 'product:price:amount', String(lowestPrice))
    setMeta('property', 'product:price:currency', 'KRW')
  } else {
    removeMeta('property', 'product:price:amount')
    removeMeta('property', 'product:price:currency')
  }
  setLink('canonical', canonicalUrl)
  setLink('alternate', canonicalUrl, 'ko-KR')
  setLink('alternate', canonicalUrl, 'x-default')
  setJsonLd(createStructuredData({ canonicalUrl, category, description, image, origin, posts, selectedPost, title }))
}

export function getProductPath(slug: string) {
  return `/product/${encodeURIComponent(slug)}`
}

export function getPublicSiteOrigin() {
  return canonicalSiteOrigin(document.head.querySelector<HTMLMetaElement>('meta[name="site-origin"]')?.content)
}

export function getProductShareUrl(slug: string) {
  return new URL(getProductPath(slug), getPublicSiteOrigin()).href
}

export function getCategoryPath(category: string) {
  return `/celeb/${encodeURIComponent(category)}`
}

export function readSeoRoute(pathname: string) {
  const productMatch = pathname.match(/\/(?:blog\/)?product\/([^/]+)\/?$/)
  const categoryMatch = pathname.match(/\/(?:blog\/)?celeb\/([^/]+)\/?$/)
  return {
    category: categoryMatch ? safelyDecode(categoryMatch[1]) : '',
    product: productMatch ? safelyDecode(productMatch[1]) : '',
  }
}

function createStructuredData({
  canonicalUrl,
  category,
  description,
  image,
  origin,
  posts,
  selectedPost,
  title,
}: SeoState & { canonicalUrl: string; description: string; image: string; origin: string; title: string }) {
  const organization = {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: SEO_SITE_NAME,
    alternateName: 'POWER PUFF CELEB',
    url: `${origin}/`,
    logo: `${origin}/powerpuffceleb-logo.svg`,
  }

  const website = {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    url: `${origin}/`,
    name: SEO_SITE_NAME,
    alternateName: 'POWER PUFF CELEB',
    description: SEO_HOME_DESCRIPTION,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${origin}/#organization` },
  }

  if (selectedPost) {
    const offers = selectedPost.productLinks.map(createOffer).filter(Boolean)
    const product = {
      '@type': 'Product',
      '@id': `${canonicalUrl}#product`,
      name: selectedPost.title,
      description,
      image: selectedPost.coverImage ? [image] : undefined,
      category: `${selectedPost.category} 착용·소개 상품`,
      sku: selectedPost.id,
      url: canonicalUrl,
      offers: offers.length === 1 ? offers[0] : offers.length > 1 ? offers : undefined,
    }

    return {
      '@context': 'https://schema.org',
      '@graph': [
        organization,
        website,
        {
          '@type': 'WebPage',
          '@id': `${canonicalUrl}#webpage`,
          url: canonicalUrl,
          name: title,
          description,
          inLanguage: 'ko-KR',
          isPartOf: { '@id': `${origin}/#website` },
          mainEntity: { '@id': `${canonicalUrl}#product` },
        },
        product,
        createBreadcrumb(origin, [
          ['홈', '/'],
          [selectedPost.category, getCategoryPath(selectedPost.category)],
          [selectedPost.title, getProductPath(selectedPost.slug || selectedPost.id)],
        ]),
      ],
    }
  }

  const filteredPosts = posts.filter((post) => post.status === 'published' && (category === 'all' || post.category === category))
  const collectionName = category === 'all' ? SEO_HOME_TITLE : `${category} 착용·광고 상품 핫템`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      website,
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#collection`,
        url: canonicalUrl,
        name: collectionName,
        description,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': `${origin}/#website` },
        about: category === 'all' ? undefined : { '@type': 'Person', name: category },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: filteredPosts.length,
          itemListElement: filteredPosts.slice(0, 50).map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: post.title,
            url: new URL(getProductPath(post.slug || post.id), origin).href,
          })),
        },
      },
      ...(category === 'all' ? [] : [createBreadcrumb(origin, [['홈', '/'], [category, getCategoryPath(category)]])]),
    ],
  }
}

function createOffer(link: ProductLink) {
  const price = readKrwPrice(link.price)
  const href = publicHttpUrl(link.href)
  if (!href || price === null) return null
  return {
    '@type': 'Offer',
    url: href,
    price,
    priceCurrency: 'KRW',
    seller: link.mall.trim() ? { '@type': 'Organization', name: link.mall.trim() } : undefined,
  }
}

function createBreadcrumb(origin: string, items: Array<[string, string]>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: new URL(path, origin).href,
    })),
  }
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

function removeMeta(attribute: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove()
}

function readLowestPrice(links: ProductLink[]) {
  const prices = links
    .map(createOffer)
    .filter((offer) => offer !== null)
    .map((offer) => offer.price)
  return prices.length ? Math.min(...prices) : null
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`
  let element = document.head.querySelector<HTMLLinkElement>(selector)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    if (hreflang) element.hreflang = hreflang
    document.head.append(element)
  }
  element.href = href
}

function setJsonLd(value: unknown) {
  let element = document.head.querySelector<HTMLScriptElement>('script[data-powerpuffceleb-seo]')
  if (!element) {
    element = document.createElement('script')
    element.type = 'application/ld+json'
    element.dataset.powerpuffcelebSeo = 'true'
    document.head.append(element)
  }
  element.textContent = JSON.stringify(value).replace(/</g, '\\u003c')
}

function safelyDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function truncate(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}…` : normalized
}
