import type { Post } from '../../../entities/post/model/types'

export function normalizeProductSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '')
}

export function searchProductTitles(posts: Post[], query: string) {
  const terms = query.normalize('NFKC').trim().split(/\s+/).map(normalizeProductSearch).filter(Boolean)
  if (!terms.length) return []
  return posts.filter((post) => post.status === 'published' && terms.every((term) => normalizeProductSearch(post.title).includes(term)))
}
