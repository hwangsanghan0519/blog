import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FilePlus2,
  Layers3,
  Lightbulb,
  PenLine,
  Sparkles,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useKeenSlider } from 'keen-slider/react'
import 'keen-slider/keen-slider.min.css'
import { formatDate, statusLabel } from '../../../entities/post/lib/formatters'
import type { Post, PostStatus } from '../../../entities/post/model/types'
import type { ViewMode } from '../../../pages/blog-studio/model/types'

type DashboardViewProps = {
  post: Post
  posts: Post[]
  onCreateFromTemplate: (template: Partial<Post>) => void
  onDelete: () => void
  onDuplicate: () => void
  onPatchPost: (postId: string, patch: Partial<Post>) => void
  onSelectPost: (postId: string) => void
  onViewChange: (view: ViewMode) => void
}

const workflow: Array<{ status: PostStatus; title: string; icon: React.ReactNode }> = [
  { status: 'draft', title: '쓰기 중', icon: <PenLine size={17} /> },
  { status: 'published', title: '발행됨', icon: <CheckCircle2 size={17} /> },
  { status: 'archived', title: '보관함', icon: <Layers3 size={17} /> },
]

const templates: Array<{
  title: string
  description: string
  icon: React.ReactNode
  content: string
  tags: string[]
}> = [
  {
    title: '오늘의 기록',
    description: '하루 회고, 느낀 점, 다음 행동을 빠르게 정리합니다.',
    icon: <Lightbulb size={20} />,
    tags: ['daily', 'note'],
    content:
      '<h1>오늘의 기록</h1><h2>오늘 가장 기억나는 장면</h2><p></p><h2>배운 점</h2><p></p><h2>내일 해볼 일</h2><ul><li><p></p></li></ul>',
  },
  {
    title: '리뷰 글',
    description: '제품, 책, 공간, 서비스를 구조적으로 리뷰합니다.',
    icon: <Sparkles size={20} />,
    tags: ['review'],
    content:
      '<h1>리뷰 제목</h1><p>한 줄 요약을 적어보세요.</p><h2>좋았던 점</h2><ul><li><p></p></li></ul><h2>아쉬운 점</h2><ul><li><p></p></li></ul><h2>추천 대상</h2><p></p>',
  },
  {
    title: '체크리스트',
    description: '해야 할 일과 기준을 목록 중심으로 관리합니다.',
    icon: <ClipboardList size={20} />,
    tags: ['checklist'],
    content:
      '<h1>체크리스트</h1><h2>목표</h2><p></p><h2>해야 할 일</h2><ul><li><p>첫 번째 항목</p></li><li><p>두 번째 항목</p></li></ul><h2>완료 기준</h2><p></p>',
  },
]

export function DashboardView({
  post,
  posts,
  onCreateFromTemplate,
  onDelete,
  onDuplicate,
  onPatchPost,
  onSelectPost,
  onViewChange,
}: DashboardViewProps) {
  const [idea, setIdea] = useState('')
  const [bestIndex, setBestIndex] = useState(0)
  const bestPosts = getBestPosts(posts)
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    initial: 0,
    loop: bestPosts.length > 1,
    mode: 'snap',
    slides: { perView: 1, spacing: 16 },
    slideChanged(instance) {
      setBestIndex(instance.track.details.rel)
    },
  })

  const createIdeaDraft = () => {
    const title = idea.trim()
    if (!title) return

    onCreateFromTemplate({
      title,
      excerpt: '메인에서 빠르게 저장한 아이디어입니다.',
      content: `<h1>${escapeHtml(title)}</h1><p>아이디어를 확장해보세요.</p><h2>핵심 메모</h2><p>${escapeHtml(title)}</p>`,
      tags: ['idea'],
      status: 'draft',
    })
    setIdea('')
  }

  return (
    <section className="dashboard-home">
      <article className="home-hero-card">
        <div>
          <span>오늘 이어서 쓸 글</span>
          <h2>{post.title}</h2>
          <p>{post.excerpt || '요약을 작성하면 목록과 미리보기에서 더 또렷하게 보입니다.'}</p>
        </div>
        <div className="home-hero-actions">
          <button type="button" onClick={() => onViewChange('editor')}>
            <PenLine size={18} /> 바로 편집
          </button>
          <button type="button" onClick={() => onViewChange('preview')}>
            <Eye size={18} /> 읽어보기
          </button>
        </div>
      </article>

      <section className="best-post-shell" aria-label="공개 메인 베스트 글">
        <div ref={sliderRef} className="keen-slider best-post-slider">
          {bestPosts.map((bestPost) => (
            <article className="keen-slider__slide best-post-slide" key={bestPost.id}>
              <div className="best-slider-copy">
                <span>
                  <Star size={16} /> 공개 홈 베스트
                </span>
                <h2>{bestPost.title}</h2>
                <p>{bestPost.excerpt || plainSnippet(bestPost.content)}</p>
                <div className="best-slider-meta">
                  <small>{bestPost.category || '분류 없음'}</small>
                  <small>{formatDate(bestPost.updatedAt)}</small>
                  <small>{bestPost.tags.length ? bestPost.tags.slice(0, 3).join(', ') : '태그 없음'}</small>
                </div>
                <div className="best-slider-actions">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPost(bestPost.id)
                      onViewChange('preview')
                    }}
                  >
                    <Eye size={18} /> 방문자처럼 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPost(bestPost.id)
                      onViewChange('editor')
                    }}
                  >
                    <PenLine size={18} /> 다듬기
                  </button>
                </div>
              </div>

              <div className="best-slider-visual">
                {bestPost.coverImage ? <img src={bestPost.coverImage} alt="" /> : <Sparkles size={56} />}
              </div>
            </article>
          ))}
        </div>

        <div className="best-slider-controls">
          <button
            type="button"
            aria-label="이전 베스트 글"
            onClick={() => slider.current?.prev()}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {bestPosts.map((item, index) => (
              <button
                className={index === bestIndex % bestPosts.length ? 'is-active' : ''}
                key={item.id}
                type="button"
                aria-label={`${index + 1}번째 베스트 글`}
                onClick={() => slider.current?.moveToIdx(index)}
              />
            ))}
          </span>
          <button
            type="button"
            aria-label="다음 베스트 글"
            onClick={() => slider.current?.next()}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section className="idea-capture" aria-label="빠른 아이디어 캡처">
        <div>
          <span>생각이 떠올랐나요?</span>
          <strong>한 줄만 적어도 초안으로 바꿔둘게요.</strong>
        </div>
        <div className="idea-input-row">
          <input
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createIdeaDraft()
            }}
            placeholder="예: 오늘의집 같은 UX를 블로그에 적용하는 방법"
          />
          <button type="button" onClick={createIdeaDraft}>
            초안 만들기
          </button>
        </div>
      </section>

      <section className="template-strip" aria-label="글 템플릿">
        {templates.map((template) => (
          <button
            key={template.title}
            type="button"
            onClick={() =>
              onCreateFromTemplate({
                title: template.title,
                excerpt: template.description,
                content: template.content,
                tags: template.tags,
                status: 'draft',
              })
            }
          >
            {template.icon}
            <span>
              <strong>{template.title}</strong>
              <small>{template.description}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="workflow-board" aria-label="글 운영 보드">
        {workflow.map((lane) => {
          const lanePosts = posts.filter((item) => item.status === lane.status)

          return (
            <article className="workflow-lane" key={lane.status}>
              <header>
                <span>{lane.icon}</span>
                <strong>{lane.title}</strong>
                <small>{lanePosts.length}</small>
              </header>
              <div>
                {lanePosts.slice(0, 4).map((item) => (
                  <div
                    className={item.id === post.id ? 'is-selected' : ''}
                    key={item.id}
                    onClick={() => {
                      onSelectPost(item.id)
                      onViewChange(item.status === 'published' ? 'preview' : 'editor')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        onSelectPost(item.id)
                        onViewChange(item.status === 'published' ? 'preview' : 'editor')
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <strong>{item.title}</strong>
                    <small>{item.excerpt || plainSnippet(item.content)}</small>
                    <span className="workflow-card-actions" onClick={(event) => event.stopPropagation()}>
                      {item.status !== 'draft' && (
                        <button type="button" onClick={() => onPatchPost(item.id, { status: 'draft' })}>
                          초안
                        </button>
                      )}
                      {item.status !== 'published' && (
                        <button type="button" onClick={() => onPatchPost(item.id, { status: 'published' })}>
                          발행
                        </button>
                      )}
                      {item.status !== 'archived' && (
                        <button type="button" onClick={() => onPatchPost(item.id, { status: 'archived' })}>
                          보관
                        </button>
                      )}
                    </span>
                  </div>
                ))}
                {!lanePosts.length && <p>아직 글이 없습니다.</p>}
              </div>
            </article>
          )
        })}
      </section>

      <div className="dashboard-grid">
        <article className="feature-panel">
          <div className="cover-preview">
            {post.coverImage ? <img src={post.coverImage} alt="" /> : <Sparkles size={52} />}
          </div>
          <div className="panel-copy">
            <span className={`status-badge ${post.status}`}>{statusLabel(post.status)}</span>
            <h2>{post.title}</h2>
            <p>{post.excerpt || '요약을 작성하면 블로그 목록과 미리보기에서 더 또렷하게 보입니다.'}</p>
            <div className="meta-line">
              <CalendarDays size={16} /> {formatDate(post.updatedAt)}
              <Tag size={16} /> {post.tags.length ? post.tags.join(', ') : '태그 없음'}
            </div>
          </div>
        </article>

        <article className="quick-panel">
          <h2>빠른 작업</h2>
          <div className="quick-actions">
            <button type="button" onClick={() => onViewChange('editor')}>
              <PenLine size={18} /> 편집하기
            </button>
            <button type="button" onClick={() => onViewChange('preview')}>
              <Eye size={18} /> 미리보기
            </button>
            <button type="button" onClick={onDuplicate}>
              <FilePlus2 size={18} /> 복제
            </button>
            <button className="danger" type="button" onClick={onDelete}>
              <Trash2 size={18} /> 삭제
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}

function plainSnippet(content: string) {
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '본문을 작성해보세요.'
}

function getBestPosts(posts: Post[]) {
  const candidates = posts.filter((item) => item.status === 'published')
  const visiblePosts = candidates.length ? candidates : posts

  return [...visiblePosts]
    .sort((a, b) => {
      const bScore = countBestScore(b)
      const aScore = countBestScore(a)
      return bScore - aScore || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
    .slice(0, 5)
}

function countBestScore(post: Post) {
  return plainSnippet(post.content).length + post.tags.length * 12 + (post.coverImage ? 40 : 0)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
