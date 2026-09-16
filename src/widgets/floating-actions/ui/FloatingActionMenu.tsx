import { Download, Moon, PenLine, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import type { Post } from '../../../entities/post/model/types'

type FloatingActionMenuProps = {
  onBackup: () => void
  onCreate: (template?: Partial<Post>) => void
  onToggleTheme: () => void
  onWrite: () => void
}

const quickTemplates: Array<{ label: string; helper: string; template: Partial<Post> }> = [
  {
    label: '오늘의 기록',
    helper: '하루 회고 템플릿',
    template: {
      title: '오늘의 기록',
      excerpt: '오늘의 장면, 배운 점, 내일 할 일을 정리합니다.',
      tags: ['daily', 'note'],
      content:
        '<h1>오늘의 기록</h1><h2>기억나는 장면</h2><p></p><h2>배운 점</h2><p></p><h2>내일 할 일</h2><ul><li><p></p></li></ul>',
      status: 'draft',
    },
  },
  {
    label: '리뷰 글',
    helper: '제품/공간/책 리뷰',
    template: {
      title: '리뷰 글',
      excerpt: '좋았던 점과 아쉬운 점을 구조적으로 정리합니다.',
      tags: ['review'],
      content:
        '<h1>리뷰 제목</h1><p>한 줄 요약</p><h2>좋았던 점</h2><ul><li><p></p></li></ul><h2>아쉬운 점</h2><ul><li><p></p></li></ul>',
      status: 'draft',
    },
  },
]

export function FloatingActionMenu({ onBackup, onCreate, onToggleTheme, onWrite }: FloatingActionMenuProps) {
  const [open, setOpen] = useState(false)

  const run = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <div className={`floating-actions ${open ? 'is-open' : ''}`}>
      {open && (
        <div className="floating-panel" role="menu" aria-label="빠른 실행 메뉴">
          <div className="floating-panel-header">
            <span>빠른 실행</span>
            <button type="button" aria-label="플로팅 메뉴 닫기" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <button type="button" role="menuitem" onClick={() => run(() => onCreate())}>
            <Plus size={18} />
            <span>
              <strong>빈 글 쓰기</strong>
              <small>새 초안으로 바로 이동</small>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onWrite)}>
            <PenLine size={18} />
            <span>
              <strong>현재 글 편집</strong>
              <small>선택한 글 이어쓰기</small>
            </span>
          </button>

          {quickTemplates.map((item) => (
            <button key={item.label} type="button" role="menuitem" onClick={() => run(() => onCreate(item.template))}>
              <Wand2 size={18} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.helper}</small>
              </span>
            </button>
          ))}

          <div className="floating-panel-grid">
            <button type="button" role="menuitem" onClick={() => run(onBackup)}>
              <Download size={17} /> 백업
            </button>
            <button type="button" role="menuitem" onClick={() => run(onToggleTheme)}>
              <Moon size={17} /> 테마
            </button>
          </div>
        </div>
      )}

      <button className="floating-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <X size={24} /> : <Sparkles size={24} />}
      </button>
    </div>
  )
}
