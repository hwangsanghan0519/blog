import type { Post } from '../../entities/post/model/types'

import { SEO_SITE_NAME, SEO_HOME_TITLE, SEO_HOME_DESCRIPTION, SEO_FASHION_TOPICS, getHomeSeoKeywords, canonicalSiteOrigin, publicHttpUrl } from './seo-config'
import { createProductSeoNodes, getProductSeo } from './product-seo'
import type { CelebAccount } from '../../pages/commerce-studio/model/celebStoryTypes'
import { createCelebList, createCelebPerson, getCelebHomeDescription, getCelebSeo, normalizeCelebAccounts } from './celeb-seo'
export { SEO_SITE_NAME, SEO_HOME_TITLE, SEO_HOME_DESCRIPTION } from './seo-config'

type SeoState = {
  category: string
  posts: Post[]
  selectedPost?: Post
  celebAccounts?: CelebAccount[]
}

export function applyPublicSeo({ category, posts, selectedPost, celebAccounts }: SeoState) {
  // The public storefront can also render behind the admin sign-in flow.
  if (/^\/(?:blog\/)?secret(?:\/|$)/.test(window.location.pathname)) return
  const route = readSeoRoute(window.location.pathname)
  // Preserve the server's detail metadata until URL-driven React state has caught up.
  if (route.product && route.product !== selectedPost?.slug && route.product !== selectedPost?.id) return
  if (route.category && route.category !== category) return
  const origin = getPublicSiteOrigin()
  const accounts = normalizeCelebAccounts(celebAccounts)
  const celebSeo = getCelebSeo(category, accounts)
  const productSeo = selectedPost ? getProductSeo(selectedPost, origin) : undefined
  const isCategory = !selectedPost && category !== 'all'
  const canonicalPath = selectedPost
    ? getProductPath(selectedPost.slug || selectedPost.id)
    : isCategory
      ? getCategoryPath(category)
      : '/'
  const canonicalUrl = new URL(canonicalPath, origin).href
  const title = selectedPost
    ? productSeo!.pageTitle
    : isCategory
      ? celebSeo.title
      : SEO_HOME_TITLE
  const description = selectedPost
    ? productSeo!.description
    : isCategory
      ? celebSeo.description
      : getCelebHomeDescription(accounts)
  const categoryImage = isCategory ? posts.find((post) => post.status === 'published' && post.category === category && publicHttpUrl(post.coverImage, origin))?.coverImage : ''
  const image = productSeo?.image || publicHttpUrl(selectedPost?.coverImage || categoryImage, origin) || `${origin}/powerpuffceleb-og.png`
  const keywords = productSeo?.keywords ?? (isCategory ? celebSeo.keywords : getHomeSeoKeywords([
    ...posts.filter((post) => post.status === 'published').map((post) => post.category), ...accounts.map((account) => account.name),
  ]))

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
  const lowestPrice = productSeo?.productPrice
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
  setJsonLd(createStructuredData({ canonicalUrl, category, description, origin, posts, selectedPost, celebAccounts: accounts }))
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
  origin,
  posts,
  selectedPost,
  celebAccounts,
}: SeoState & { canonicalUrl: string; description: string; origin: string }) {
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
    keywords: SEO_FASHION_TOPICS.join(', '),
    inLanguage: 'ko-KR',
    publisher: { '@id': `${origin}/#organization` },
  }

  if (selectedPost) {
    return {
      '@context': 'https://schema.org',
      '@graph': [organization, website, ...createProductSeoNodes(selectedPost, origin)],
    }
  }

  const filteredPosts = posts.filter((post) => post.status === 'published' && (category === 'all' || post.category === category))
  const accounts = normalizeCelebAccounts(celebAccounts)
  const collectionName = category === 'all' ? SEO_HOME_TITLE : getCelebSeo(category, accounts).title
  const account = accounts.find((item) => item.name === category)
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
        keywords: category === 'all' ? getHomeSeoKeywords([...filteredPosts.map((post) => post.category), ...accounts.map((item) => item.name)]) : getCelebSeo(category, accounts).keywords,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': `${origin}/#website` },
        about: category === 'all' ? undefined : account ? createCelebPerson(account, origin) : { '@type': 'Person', name: category },
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
      ...(accounts.length ? [createCelebList(accounts, origin)] : []),
    ],
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
