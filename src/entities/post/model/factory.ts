import type { Post } from './types'

// 앱을 처음 열었을 때 빈 화면 대신 바로 기능을 만져볼 수 있는 샘플 글입니다.
export const starterPosts: Post[] = [
  {
    id: crypto.randomUUID(),
    title: '나만의 블로그 운영 노트',
    slug: 'private-blog-ops-note',
    excerpt: '아이디어, 회고, 긴 글 초안을 한 곳에서 정리하는 개인용 블로그 운영 템플릿입니다.',
    category: '운영',
    tags: ['pwa', 'writing', 'private'],
    content:
      '<h1>나만의 블로그 운영 노트</h1><p>이 앱은 서버 없이 브라우저에 글을 저장합니다. 초안으로 쓰고, 미리보기로 다듬고, 필요할 때 백업 파일로 내보낼 수 있어요.</p><h2>오늘 할 일</h2><ul><li><p>글감 정리</p></li><li><p>커버 이미지 업로드</p></li><li><p>발행 상태 변경</p></li></ul><blockquote><p>개인 블로그는 속도보다 계속 열어보게 되는 감각이 더 중요합니다.</p></blockquote>',
    coverImage: '',
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const createEmptyPost = (): Post => ({
  id: crypto.randomUUID(),
  title: '새 글',
  slug: `post-${Date.now()}`,
  excerpt: '',
  category: '일상',
  tags: [],
  content: '<h1>새 글</h1><p>여기에 내용을 작성하세요.</p>',
  coverImage: '',
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})
