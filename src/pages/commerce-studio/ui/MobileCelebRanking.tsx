import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Crown, Heart, LoaderCircle, Sparkles, Star, UsersRound, X } from 'lucide-react'
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
  const [turn, setTurn] = useState(0)
  const face: View = turn % 2 === 0 ? 'ranking' : 'directory'
  const coinRef = useRef<HTMLSpanElement>(null)
  const [view, setView] = useState<View>('ranking')
  const [viewport, setViewport] = useState({ height: 0, bottom: 0 })
  const pressedFace = useRef<View | null>(null)
  const releasePress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const selectingCategory = useRef(false)

  useEffect(() => {
    if (open) return
    const mobile = window.matchMedia('(max-width: 899px)')
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || !mobile.matches || pressedFace.current) return
      setTurn(previous => previous + 1)
    }, 4800)
    return () => window.clearInterval(timer)
  }, [open])
  useEffect(() => {
    const release = () => {
      if (!pressedFace.current) return
      clearTimeout(releasePress.current)
      // Keep the touched face until the synthetic click arrives, then always release it.
      releasePress.current = setTimeout(() => { pressedFace.current = null }, 400)
    }
    const cancel = () => { clearTimeout(releasePress.current); pressedFace.current = null }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    return () => {
      clearTimeout(releasePress.current)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    }
  }, [])
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

  const visibleFace = (): View => {
    if (!coinRef.current) return face
    // While turning, open the face actually visible at touch-down.
    try { return new DOMMatrixReadOnly(getComputedStyle(coinRef.current).transform).m11 >= 0 ? 'ranking' : 'directory' }
    catch { return face }
  }

  return <Dialog.Root open={open} onOpenChange={next => { selectingCategory.current = false; setOpen(next) }}>
    <Dialog.Trigger className="mobile-ranking-trigger" aria-label={face === 'ranking' ? '셀럽 랭킹 및 투표 열기' : '전체 셀럽 모아보기 열기'}
      onPointerDown={() => { clearTimeout(releasePress.current); pressedFace.current = visibleFace() }} onPointerCancel={() => { pressedFace.current = null }}
      onClick={() => { setView(pressedFace.current ?? visibleFace()); pressedFace.current = null }}>
      <span ref={coinRef} className="mobile-celeb-coin" style={{ '--coin-turn': `${turn * 180}deg` } as CSSProperties} data-side={face} aria-hidden="true">
        <span className="mobile-celeb-coin-face is-front"><Crown className="mobile-celeb-coin-symbol" size={22} strokeWidth={1.5} /><span className="mobile-celeb-coin-label">랭킹</span><span className="mobile-celeb-coin-shine" /></span>
        <span className="mobile-celeb-coin-face is-back"><Heart className="mobile-celeb-coin-symbol" size={22} strokeWidth={1.7} /><span className="mobile-celeb-coin-label">셀럽</span><span className="mobile-celeb-coin-shine" /></span>
      </span>
      <span className="mobile-celeb-jewels" aria-hidden="true"><Sparkles size={15} /><Star size={8} fill="currentColor" /><span /></span>
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
