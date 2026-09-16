import type { PostStatusFilter } from '../model/types'

export function countWords(content: string) {
  return content
    .replace(/<[^>]*>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function statusLabel(status: PostStatusFilter) {
  return ({ all: '전체', draft: '초안', published: '발행', archived: '보관' } as const)[status]
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
}

export function viewLabel(view: 'dashboard' | 'editor' | 'preview') {
  return ({ dashboard: '대시보드', editor: '편집', preview: '미리보기' } as const)[view]
}
