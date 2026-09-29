export const SEO_SITE_NAME = '파워퍼프셀럽'
export const SEO_HOME_TITLE = '파워퍼프셀럽 | 연예인·아이돌·배우 착장, 사복 패션·핫템 최저가'
export const SEO_HOME_DESCRIPTION = '아이돌·배우의 착장과 사복 패션부터 연예인·인플루언서의 핫템, 잇템, 광고 상품까지. 인스타그램·유튜브 속 셀럽 패션 정보와 착용 상품의 브랜드, 등록된 제휴몰 최저가를 파워퍼프셀럽에서 확인하세요.'
export const SEO_FASHION_TOPICS = [
  '연예인 착장', '연예인 사복 패션', '연예인 패션 정보',
  '셀럽 착장', '셀럽 패션 정보', '셀럽 사복 패션',
  '아이돌 착장', '아이돌 사복 패션', '아이돌 패션 정보',
  '배우 착장', '배우 사복 패션', '배우 패션 정보',
] as const
export const SEO_SITE_KEYWORDS = [
  SEO_SITE_NAME,
  '연예인', '아이돌', '셀럽', '배우',
  ...SEO_FASHION_TOPICS.flatMap((topic) => [topic, topic.replaceAll(' ', '')]),
  '연예인 핫템', '인플루언서 핫템', '인플루언서 잇템', '인플루언서 추천 상품', '연예인 착용 상품', '인스타 광고 상품',
  '유튜브 소개 상품', '셀럽 잇템', '광고템', '제휴몰 가격 비교', '최저가',
].join(', ')

export function getHomeSeoKeywords(names: string[]) {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean)), SEO_SITE_KEYWORDS].join(', ')
}

export function seoTitle(subject: string, maxLength = 68) {
  const suffix = ` | ${SEO_SITE_NAME}`
  const normalized = subject.replace(/\s+/g, ' ').trim()
  const budget = maxLength - suffix.length
  return `${normalized.length > budget ? `${normalized.slice(0, budget - 1).trim()}…` : normalized}${suffix}`
}

export function publicHttpUrl(value: unknown, origin?: string) {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value.trim(), origin)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

// Do not turn ranges, installment counts or discount percentages into a fictitious price.
export function readKrwPrice(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(?:₩\s*|KRW\s*)?((?:\d{1,3}(?:,\d{3})+|\d+))(?:\s*원|\s*KRW)?$/i)
  if (!match) return null
  const price = Number(match[1].replaceAll(',', ''))
  return Number.isSafeInteger(price) && price > 0 ? price : null
}
export const SEO_SITE_ORIGIN = 'https://powerpuffceleb.co.kr'

export function canonicalSiteOrigin(value?: string) {
  const configured = publicHttpUrl(value)
  if (!configured) return SEO_SITE_ORIGIN
  const url = new URL(configured)
  // Old environment values and www links must never revive the retired canonical.
  return ['powerpuffceleb.co.kr', 'www.powerpuffceleb.co.kr', 'ssenshop.netlify.app', 'ssenshop.co.kr', 'www.ssenshop.co.kr'].includes(url.hostname)
    ? SEO_SITE_ORIGIN : url.origin
}
