export const SEO_SITE_NAME = '파워퍼프셀럽'
export const SEO_HOME_TITLE = '파워퍼프셀럽 | 연예인·인플루언서 핫템, 잇템, 광고 상품 최저가'
export const SEO_HOME_DESCRIPTION = '유튜브와 인스타그램에서 연예인·인플루언서가 착용하고 소개한 핫템, 잇템, 광고 상품을 모아 제휴몰 최저가 링크로 연결하는 파워퍼프셀럽 큐레이션입니다.'

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
