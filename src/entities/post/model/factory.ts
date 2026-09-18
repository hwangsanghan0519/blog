import type { Post } from './types'
import { createId } from '../../../shared/lib/id'

// 앱을 처음 열었을 때 빈 화면 대신 바로 기능을 만져볼 수 있는 샘플 상품입니다.
export const starterPosts: Post[] = [
  {
    id: createId(),
    title: '로지텍 MX Master 3S',
    slug: 'logitech-mx-master-3s',
    excerpt: '사무용 끝판왕 무선 마우스\n쿠팡/지마켓/11번가 가격을 한 번에 비교하세요.',
    category: '디지털',
    tags: ['무선마우스', '업무템', '최저가'],
    content:
      '<h1>이 상품을 고른 이유</h1><p>손목 부담이 적고, 여러 기기를 오가며 쓰기 좋은 생산성 마우스입니다.</p><h2>체크 포인트</h2><ul><li><p>조용한 클릭감</p></li><li><p>긴 배터리와 USB-C 충전</p></li><li><p>가로 스크롤 휠 지원</p></li></ul><blockquote><p>가격 변동이 큰 상품이라 구매 전 여러 쇼핑몰을 비교하는 편이 좋습니다.</p></blockquote>',
    coverImage: '',
    purchaseTitle: '지금 제일 쎈 가격으로 이동',
    productLinks: [
      {
        id: createId(),
        mall: '쿠팡',
        price: '129,000원',
        label: '쿠팡에서 보기',
        href: 'https://www.coupang.com',
        badge: '로켓배송',
      },
      {
        id: createId(),
        mall: 'G마켓',
        price: '126,500원',
        label: 'G마켓 최저가 보기',
        href: 'https://www.gmarket.co.kr',
        badge: '쿠폰가',
      },
    ],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const createEmptyPost = (): Post => ({
  id: createId(),
  title: '새 상품',
  slug: `product-${Date.now()}`,
  excerpt: '',
  category: '디지털',
  tags: [],
  content: '<h1>상품 상세</h1><p>가격, 장점, 구매 전 체크할 점을 정리하세요.</p>',
  coverImage: '',
  purchaseTitle: '최저가 제휴몰 바로가기',
  productLinks: [],
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})
