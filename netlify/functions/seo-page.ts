type NetlifyEvent = {
  headers: Record<string, string | undefined>
  httpMethod: string
  queryStringParameters?: Record<string, string | undefined> | null
}

type ProductLink = {
  href?: unknown
  mall?: unknown
  price?: unknown
}

type Product = Record<string, unknown> & {
  category?: unknown
  content?: unknown
  coverImage?: unknown
  excerpt?: unknown
  id?: unknown
  productLinks?: unknown
  slug?: unknown
  status?: unknown
  tags?: unknown
  title?: unknown
  updatedAt?: unknown
}

type BlogSummary = {
  categories?: unknown
  posts?: unknown
}

const SITE_NAME = 'SSEN'
const DEFAULT_DESCRIPTION = '유튜브와 인스타그램에서 연예인·인플루언서가 착용하고 소개한 핫템, 잇템, 광고 상품을 모아 제휴몰 최저가 링크로 연결하는 SSEN 큐레이션입니다.'

export async function handler(event: NetlifyEvent) {
  if (event.httpMethod !== 'GET') return response(405, 'Method not allowed', 'text/plain; charset=utf-8', 'no-store')

  const kind = event.queryStringParameters?.kind
  const value = safelyDecode(event.queryStringParameters?.value?.trim() ?? '')
  if ((kind !== 'product' && kind !== 'category') || !value) {
    return response(400, '잘못된 검색 페이지 요청입니다.', 'text/plain; charset=utf-8', 'no-store')
  }

  try {
    const origin = readOrigin(event)
    const [shellResponse, dataResponse] = await Promise.all([
      fetch(`${origin}/index.html`),
      fetch(kind === 'product'
        ? `${origin}/.netlify/functions/blog-data?post=${encodeURIComponent(value)}`
        : `${origin}/.netlify/functions/blog-data?view=summary`),
    ])

    if (!shellResponse.ok || !dataResponse.ok) {
      return notFoundPage(origin, kind, value)
    }

    const shell = await shellResponse.text()
    if (kind === 'product') {
      const product = await dataResponse.json() as Product
      return renderProductPage(shell, origin, product)
    }

    const data = await dataResponse.json() as BlogSummary
    return renderCategoryPage(shell, origin, data, value)
  } catch (error) {
    return response(
      500,
      `검색 페이지를 불러오지 못했습니다: ${error instanceof Error ? error.message : 'unknown error'}`,
      'text/plain; charset=utf-8',
      'no-store',
    )
  }
}

function renderProductPage(shell: string, origin: string, product: Product) {
  const titleText = readString(product.title) || '상품'
  const category = readString(product.category) || '셀럽'
  const slug = readString(product.slug) || readString(product.id)
  if (!slug || product.status !== 'published') return notFoundPage(origin, 'product', titleText)

  const canonical = `${origin}/product/${encodeURIComponent(slug)}`
  const description = truncate(`${category}가 유튜브·인스타그램에서 소개하거나 착용한 ${titleText}. ${readString(product.excerpt) || '등록된 제휴몰 가격과 구매 링크를 확인하세요.'}`, 160)
  const pageTitle = truncate(`${titleText} | ${category} 착용·광고 핫템 - ${SITE_NAME}`, 68)
  const image = readPublicImage(product.coverImage, origin) || `${origin}/ssen-logo.svg`
  const productLinks = Array.isArray(product.productLinks) ? product.productLinks.filter(isRecord) as ProductLink[] : []
  const offers = productLinks.map((link) => createOffer(link)).filter((offer) => offer !== null)
  const productPrice = offers.length ? Math.min(...offers.map((offer) => offer.price)) : undefined
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganization(origin),
      createWebsite(origin),
      {
        '@type': 'Product',
        '@id': `${canonical}#product`,
        name: titleText,
        description,
        image: image ? [image] : undefined,
        category: `${category} 착용·소개 상품`,
        sku: readString(product.id) || slug,
        url: canonical,
        offers: offers.length === 1 ? offers[0] : offers.length > 1 ? offers : undefined,
      },
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: pageTitle,
        description,
        inLanguage: 'ko-KR',
        isPartOf: { '@id': `${origin}/#website` },
        mainEntity: { '@id': `${canonical}#product` },
        primaryImageOfPage: { '@type': 'ImageObject', url: image },
      },
      createBreadcrumb(origin, [
        ['홈', '/'],
        [category, `/celeb/${encodeURIComponent(category)}`],
        [titleText, `/product/${encodeURIComponent(slug)}`],
      ]),
    ],
  }
  const fallback = `
    <main class="seo-fallback">
      <nav aria-label="경로"><a href="/">SSEN</a><span>/</span><a href="/celeb/${encodeURIComponent(category)}">${escapeHtml(category)}</a></nav>
      <article>
        <div class="seo-fallback-copy">
          <p class="seo-fallback-kicker">${escapeHtml(category)} PICK</p>
          <h1>${escapeHtml(titleText)}</h1>
          <p>${escapeHtml(description)}</p>
          ${renderOfferList(productLinks)}
        </div>
        <img src="${escapeHtml(image)}" alt="${escapeHtml(`${titleText} 상품 이미지`)}" />
      </article>
    </main>`

  return htmlResponse(injectSeo(shell, {
    canonical,
    description,
    image,
    keywords: createKeywords(product, category),
    pageTitle,
    productPrice,
    structuredData,
    type: 'product',
    fallback,
  }))
}

function renderCategoryPage(shell: string, origin: string, data: BlogSummary, category: string) {
  const categories = Array.isArray(data.categories) ? data.categories.map(readString).filter(Boolean) : []
  const allPosts = Array.isArray(data.posts) ? data.posts.filter(isRecord) as Product[] : []
  const posts = allPosts.filter((post) => post.status === 'published' && readString(post.category) === category)
  if (!categories.includes(category) && !posts.length) return notFoundPage(origin, 'category', category)

  const canonical = `${origin}/celeb/${encodeURIComponent(category)}`
  const pageTitle = truncate(`${category} 착용·광고 상품, 인스타·유튜브 핫템 | ${SITE_NAME}`, 68)
  const description = `${category}가 유튜브와 인스타그램에서 착용·소개·광고한 상품을 모았습니다. 화제의 핫템과 잇템, 등록된 제휴몰 최저가를 SSEN에서 확인하세요.`
  const firstImage = posts.map((post) => readPublicImage(post.coverImage, origin)).find(Boolean) || `${origin}/ssen-logo.svg`
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganization(origin),
      createWebsite(origin),
      {
        '@type': 'CollectionPage',
        '@id': `${canonical}#collection`,
        url: canonical,
        name: `${category} 착용·광고 상품 핫템`,
        description,
        inLanguage: 'ko-KR',
        about: { '@type': 'Person', name: category },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: posts.length,
          itemListElement: posts.slice(0, 50).map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: readString(post.title),
            url: `${origin}/product/${encodeURIComponent(readString(post.slug) || readString(post.id))}`,
          })),
        },
      },
      createBreadcrumb(origin, [['홈', '/'], [category, `/celeb/${encodeURIComponent(category)}`]]),
    ],
  }
  const cards = posts.map((post) => {
    const title = readString(post.title) || '상품'
    const slug = readString(post.slug) || readString(post.id)
    const image = readPublicImage(post.coverImage, origin)
    return `<li><a href="/product/${encodeURIComponent(slug)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`${title} 상품 이미지`)}" />` : ''}<strong>${escapeHtml(title)}</strong><span>${escapeHtml(readString(post.excerpt))}</span></a></li>`
  }).join('')
  const fallback = `
    <main class="seo-fallback seo-fallback-category">
      <nav aria-label="경로"><a href="/">SSEN</a><span>/</span><span>${escapeHtml(category)}</span></nav>
      <header><p class="seo-fallback-kicker">CELEB &amp; INFLUENCER PICKS</p><h1>${escapeHtml(category)} 핫템</h1><p>${escapeHtml(description)}</p></header>
      <ul>${cards || '<li>공개된 상품을 준비하고 있습니다.</li>'}</ul>
    </main>`

  return htmlResponse(injectSeo(shell, {
    canonical,
    description,
    image: firstImage,
    keywords: `${category}, ${category} 착용, ${category} 인스타, ${category} 유튜브, ${category} 광고, 연예인 핫템, 인플루언서 잇템, 최저가`,
    pageTitle,
    structuredData,
    type: 'website',
    fallback,
  }))
}

function injectSeo(shell: string, seo: {
  canonical: string
  description: string
  fallback: string
  image: string
  keywords: string
  pageTitle: string
  productPrice?: number
  structuredData: unknown
  type: 'product' | 'website'
}) {
  const cleaned = shell
    .replace(/\s*<title>[\s\S]*?<\/title>\s*/i, '\n')
    .replace(/\s*<meta\s+(?:name|property)="(?:description|keywords|robots|googlebot|og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, '\n')
    .replace(/\s*<link\s+rel="(?:canonical|alternate)"[^>]*>\s*/gi, '\n')
    .replace(/\s*<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/gi, '\n')
  const meta = `
    <title>${escapeHtml(seo.pageTitle)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <meta name="googlebot" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(seo.canonical)}" />
    <link rel="alternate" hreflang="ko-KR" href="${escapeHtml(seo.canonical)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(seo.canonical)}" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:type" content="${seo.type}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(seo.pageTitle)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${escapeHtml(seo.canonical)}" />
    <meta property="og:image" content="${escapeHtml(seo.image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(seo.image)}" />
    <meta property="og:image:alt" content="${escapeHtml(seo.pageTitle)}" />
    ${seo.productPrice ? `<meta property="product:price:amount" content="${seo.productPrice}" /><meta property="product:price:currency" content="KRW" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seo.pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${escapeHtml(seo.image)}" />
    <script type="application/ld+json" data-ssen-seo>${safeJson(seo.structuredData)}</script>
    <style>
      .seo-fallback{box-sizing:border-box;min-height:100vh;background:#f4efe5;color:#080808;padding:32px clamp(20px,6vw,88px);font-family:Arial,sans-serif}.seo-fallback *{box-sizing:border-box}.seo-fallback nav{display:flex;gap:10px;margin-bottom:42px;font-size:14px}.seo-fallback a{color:inherit}.seo-fallback article{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,42%);gap:clamp(28px,6vw,90px);align-items:center}.seo-fallback article>img{width:100%;max-height:70vh;object-fit:cover}.seo-fallback h1{max-width:900px;margin:8px 0 22px;font-size:clamp(38px,7vw,92px);line-height:.96;letter-spacing:-.06em}.seo-fallback p{max-width:720px;line-height:1.7}.seo-fallback-kicker{font-size:13px!important;font-weight:800;letter-spacing:.12em}.seo-fallback-offers{padding:0;list-style:none}.seo-fallback-offers a{display:flex;justify-content:space-between;gap:18px;padding:16px 0;border-bottom:1px solid #aaa;text-decoration:none}.seo-fallback-category header{max-width:880px}.seo-fallback-category ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:22px;padding:30px 0;list-style:none}.seo-fallback-category li a{display:grid;gap:10px;text-decoration:none}.seo-fallback-category li img{width:100%;aspect-ratio:4/5;object-fit:cover}.seo-fallback-category li strong{font-size:20px}.seo-fallback-category li span{line-height:1.5}@media(max-width:700px){.seo-fallback article{grid-template-columns:1fr}.seo-fallback article>img{grid-row:1}.seo-fallback{padding-top:20px}}
    </style>`

  return cleaned
    .replace('</head>', `${meta}\n  </head>`)
    .replace(/<div\s+id="root"\s*>[\s\S]*?<\/div>/i, `<div id="root">${seo.fallback}</div>`)
}

function renderOfferList(links: ProductLink[]) {
  const items = links.flatMap((link) => {
    const href = readHttpUrl(link.href)
    if (!href) return []
    const mall = readString(link.mall) || '제휴몰'
    const price = readString(link.price) || '가격 보기'
    return [`<li><a href="${escapeHtml(href)}" rel="sponsored nofollow"><span>${escapeHtml(mall)}</span><strong>${escapeHtml(price)}</strong></a></li>`]
  }).join('')
  return items ? `<h2>제휴몰 가격</h2><ul class="seo-fallback-offers">${items}</ul>` : ''
}

function createOffer(link: ProductLink) {
  const href = readHttpUrl(link.href)
  const price = Number(readString(link.price).replace(/[^\d]/g, ''))
  if (!href || !Number.isFinite(price) || price <= 0) return null
  const mall = readString(link.mall)
  return {
    '@type': 'Offer',
    url: href,
    price,
    priceCurrency: 'KRW',
    seller: mall ? { '@type': 'Organization', name: mall } : undefined,
  }
}

function createOrganization(origin: string) {
  return {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: SITE_NAME,
    url: `${origin}/`,
    logo: `${origin}/ssen-logo.svg`,
  }
}

function createWebsite(origin: string) {
  return {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: SITE_NAME,
    url: `${origin}/`,
    inLanguage: 'ko-KR',
    description: DEFAULT_DESCRIPTION,
    publisher: { '@id': `${origin}/#organization` },
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

function createKeywords(product: Product, category: string) {
  const tags = Array.isArray(product.tags) ? product.tags.map(readString).filter(Boolean) : []
  return Array.from(new Set([
    readString(product.title),
    category,
    ...tags,
    '연예인 핫템',
    '인플루언서 핫템',
    '연예인 착용 상품',
    '인스타 광고 상품',
    '유튜브 소개 상품',
    '셀럽 잇템',
    '최저가',
  ].filter(Boolean))).join(', ')
}

function notFoundPage(origin: string, kind: string, value: string) {
  const title = kind === 'product' ? '상품을 찾을 수 없습니다' : '셀럽 페이지를 찾을 수 없습니다'
  return response(404, `<!doctype html><html lang="ko-KR"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>${title} | SSEN</title><link rel="canonical" href="${origin}/"></head><body><main><h1>${title}</h1><p>${escapeHtml(value)}</p><a href="/">SSEN 홈으로</a></main></body></html>`, 'text/html; charset=utf-8', 'no-store')
}

function htmlResponse(body: string) {
  return response(200, body, 'text/html; charset=utf-8', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
}

function response(statusCode: number, body: string, contentType: string, cacheControl: string) {
  return {
    statusCode,
    headers: {
      'cache-control': cacheControl,
      'content-type': contentType,
      'x-content-type-options': 'nosniff',
    },
    body,
  }
}

function readOrigin(event: NetlifyEvent) {
  const host = event.headers['x-forwarded-host'] ?? event.headers.host
  if (host) {
    const protocol = event.headers['x-forwarded-proto'] ?? (host.includes('localhost') ? 'http' : 'https')
    return `${protocol}://${host}`.replace(/\/$/, '')
  }

  return process.env.URL?.trim().replace(/\/$/, '') || 'http://localhost:8888'
}

function readPublicImage(value: unknown, origin: string) {
  const image = readString(value)
  if (!image || image.startsWith('data:')) return ''
  try {
    return new URL(image, origin).href
  } catch {
    return ''
  }
}

function readHttpUrl(value: unknown) {
  const url = readString(value)
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  } catch {
    return ''
  }
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
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
