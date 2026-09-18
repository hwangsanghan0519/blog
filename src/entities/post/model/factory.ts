import type { Post } from './types'
import { createId } from '../../../shared/lib/id'

export const createEmptyPost = (): Post => ({
  id: createId(),
  title: '새 상품',
  slug: `product-${Date.now()}`,
  excerpt: '',
  category: '디지털',
  tags: [],
  content: '<h1>상품 상세</h1><p>가격, 장점, 구매 전 체크할 점을 정리하세요.</p>',
  coverImage: '',
  detailImages: ['', '', '', ''],
  detailDescriptions: ['', '', '', ''],
  purchaseTitle: '최저가 제휴몰 바로가기',
  productLinks: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})
