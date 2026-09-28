import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Crown, Heart, LoaderCircle, UsersRound, X } from 'lucide-react'
import type { CelebVoteRank } from '../api/celebVoteApi'
import { getInfluenceGauge } from '../lib/influenceGauge'
import { getCategoryPath } from '../../../shared/lib/seo'
import './MobileCelebRanking.css'

type Props = {
  ranking: CelebVoteRank[]
  categoryImages: Record<string, string>
  celebrities: string[]
  onSelectCategory: (category: string) => void
  votedCategory: string | null
  pendingCategory: string
  feedback: string
  onVote: (category: string) => Promise<void>
}

type View = 'ranking' | 'directory'

export function MobileCelebRanking({ ranking, categoryImages, celebrities, onSelectCategory, votedCategory, pendingCategory, feedback, onVote }: Props) {
  const [open, setOpen] = useState(false)
  const [face, setFace] = useState<View>('ranking')
  const [burst, setBurst] = useState(0)
  const [view, setView] = useState<View>('ranking')
  const [viewport, setViewport] = useState({ height: 0, bottom: 0 })
  const pressedFace = useRef<View | null>(null)
  const selectingCategory = useRef(false)

  useEffect(() => {
    if (open) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || window.innerWidth >= 900 || pressedFace.current) return
      setFace(previous => previous === 'ranking' ? 'directory' : 'ranking')
      setBurst(previous => previous + 1)
    }, 3333)
    return () => window.clearInterval(timer)
  }, [open])
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (window.innerWidth >= 900) { setOpen(false); return }
      const visual = window.visualViewport
      setViewport({ height: visual?.height ?? window.innerHeight, bottom: visual ? Math.max(0, window.innerHeight - visual.height - visual.offsetTop) : 0 })
    }
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [open])

  return <Dialog.Root open={open} onOpenChange={next => { selectingCategory.current = false; setOpen(next) }}>
    <Dialog.Trigger className="mobile-ranking-trigger" aria-label={face === 'ranking' ? '셀럽 랭킹 및 투표 열기' : '전체 셀럽 모아보기 열기'}
      onPointerDown={() => { pressedFace.current = face }} onPointerCancel={() => { pressedFace.current = null }}
      onClick={() => { setView(pressedFace.current ?? face); pressedFace.current = null }}>
      <span className="mobile-celeb-coin" data-side={face} aria-hidden="true">
        <span className="mobile-celeb-coin-face is-front"><Crown size={21} strokeWidth={1.8} /><span>랭킹</span></span>
        <span className="mobile-celeb-coin-face is-back"><UsersRound size={21} strokeWidth={1.8} /><span>셀럽</span></span>
      </span>
      {burst > 0 && <span key={burst} className="mobile-celeb-coin-burst" data-side={face} aria-hidden="true">
        {[[-28, -23, -22], [-12, -42, 14], [12, -34, -12], [30, -18, 24]].map(([x, y, tilt], index) => <Heart key={index} fill="currentColor" strokeWidth={1.3}
          style={{ '--heart-x': `${x}px`, '--heart-y': `${y}px`, '--heart-tilt': `${tilt}deg`, '--heart-delay': `${index * 54}ms` } as CSSProperties} />)}
      </span>}
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="mobile-ranking-dim" />
      <Dialog.Content className={`mobile-ranking-sheet${view === 'directory' ? ' is-directory' : ''}`} data-compact={viewport.height > 0 && viewport.height < 520 ? '' : undefined}
        style={viewport.height ? { '--celeb-sheet-height': `${viewport.height}px`, '--celeb-keyboard-offset': `${viewport.bottom}px` } as CSSProperties : undefined}
        onCloseAutoFocus={event => { if (selectingCategory.current) event.preventDefault() }}>
        <div className="mobile-ranking-handle" aria-hidden="true" />
        <header className="mobile-ranking-heading">
          <div><span className="mobile-ranking-eyebrow">{view === 'ranking' ? <><Crown size={12} /> CELEB RANKING</> : <><UsersRound size={12} /> ALL CELEBS</>}</span>
            <Dialog.Title>{view === 'ranking' ? <>오늘의 최애에게<span>마음을 한 표</span></> : <>셀럽 모아보기<span>{celebrities.length}명</span></>}</Dialog.Title>
          </div>
          <Dialog.Close className="mobile-ranking-close" aria-label="셀럽 레이어 닫기"><X size={20} /></Dialog.Close>
        </header>
        <Dialog.Description className="mobile-ranking-description">{view === 'ranking' ? '하루 한 번, 응원하는 셀럽을 골라주세요.' : '셀럽을 누르면 아이템을 모아 볼 수 있어요.'}</Dialog.Description>
        <div className="mobile-celeb-view-switch" role="group" aria-label="셀럽 보기 선택">
          <button type="button" aria-pressed={view === 'ranking'} onClick={() => setView('ranking')}><Crown size={14} />랭킹</button>
          <button type="button" aria-pressed={view === 'directory'} onClick={() => setView('directory')}><UsersRound size={14} />전체 셀럽 <span>{celebrities.length}</span></button>
        </div>
        {view === 'directory' ? <div className="mobile-ranking-scroll" key="directory">
            <ul className="mobile-celeb-directory-grid">{celebrities.map(name => <li key={name}>
              <a href={getCategoryPath(name)} onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault(); selectingCategory.current = true; setOpen(false); onSelectCategory(name)
              }}>
                <DirectoryPortrait src={categoryImages[name]} name={name} />
                <strong>{name}</strong>
              </a>
            </li>)}</ul>
          </div>
         : <>
        <div className="mobile-ranking-scroll" key="ranking">
          <ol className="mobile-ranking-list">
            {ranking.map((item, index) => {
              const picked = votedCategory === item.category
              const pending = pendingCategory === item.category
              const gauge = getInfluenceGauge(item.votes)
              return <li key={item.category} className={`${index < 3 ? 'is-top' : ''} ${picked ? 'is-picked' : ''}`}>
                <span className="mobile-ranking-place">{String(index + 1).padStart(2, '0')}</span>
                <div className="mobile-ranking-avatar">{categoryImages[item.category]
                  ? <img src={categoryImages[item.category]} alt="" loading="lazy" decoding="async" />
                  : <span aria-hidden="true">{item.category.slice(0, 1)}</span>}{index === 0 && <Crown size={13} aria-hidden="true" />}</div>
                <div className="mobile-ranking-person"><strong>{item.category}</strong><span>응원 게이지 {gauge}%</span>
                  <span className="mobile-ranking-meter" role="meter" aria-label={`${item.category} 응원 게이지`} aria-valuemin={0} aria-valuemax={99} aria-valuenow={gauge}><i style={{ width: `${Math.max(2, gauge)}%` }} /></span>
                </div>
                <button className="mobile-ranking-pick" type="button" disabled={Boolean(votedCategory || pendingCategory)}
                  aria-label={picked ? `${item.category} 투표 완료` : `${item.category}에게 투표`} onClick={() => void onVote(item.category)}>
                  {pending ? <LoaderCircle size={15} className="is-spinning" /> : picked ? <Check size={15} /> : <Heart size={15} fill={picked ? 'currentColor' : 'none'} />}
                  <span>{picked ? '완료' : '투표'}</span>
                </button>
              </li>
            })}
          </ol>
        </div>
        <footer className={`mobile-ranking-notice ${votedCategory ? 'is-complete' : ''}`} aria-live="polite">
          <span>{votedCategory ? `오늘의 원픽 · ${votedCategory}` : '매일 자정, 새로운 마음을 전할 수 있어요'}</span>
          {feedback && <strong>{feedback}</strong>}
        </footer>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function DirectoryPortrait({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState('')
  return <span className="mobile-celeb-directory-portrait">{src && src !== failedSrc
    ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />
    : <span aria-hidden="true">{name.slice(0, 1)}</span>}</span>
}
