import { publicHttpUrl } from '../../../shared/lib/seo-config'
import type { ProductSource, ProductSourceType } from '../model/types'

export const PRODUCT_SOURCE_LABELS = {
  youtube: '유튜브',
  instagram: '인스타',
  daily: '일상',
  brand: '브랜드',
  broadcast: '방송',
  drama: '드라마',
  variety: '예능',
} as const satisfies Record<ProductSourceType, string>

export function normalizeProductSource(value: unknown): ProductSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (typeof source.type !== 'string' || !Object.hasOwn(PRODUCT_SOURCE_LABELS, source.type)) return null
  return {
    type: source.type as ProductSourceType,
    url: typeof source.url === 'string' ? source.url.trim() : '',
  }
}

export function productSourceLink(value: unknown) {
  const source = normalizeProductSource(value)
  if (!source) return null
  const href = publicHttpUrl(source.url)
  return href ? { ...source, href, label: PRODUCT_SOURCE_LABELS[source.type] } : null
}
