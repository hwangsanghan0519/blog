// Keep the existing mobile collection contract so resizing never loses saved cards.
export const POCA_COLLECTION_KEY = 'powerpuffceleb:poca-collection:v1'

export function parseDesktopCollection(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]')
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string'))].slice(0, 2000) : []
  } catch { return [] }
}

export function shuffleDesktopCards(ids: string[], random = Math.random): string[] {
  const next = [...ids]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  if (next.length > 1 && next.every((id, index) => id === ids[index])) next.push(next.shift()!)
  return next
}
