import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, Crown, Heart, LoaderCircle, X } from 'lucide-react'
import type { CelebVoteRank } from '../api/celebVoteApi'
import { getInfluenceGauge } from '../lib/influenceGauge'
import './MobileCelebRanking.css'

type Props = {
  ranking: CelebVoteRank[]
  categoryImages: Record<string, string>
  votedCategory: string | null
  pendingCategory: string
  feedback: string
  onVote: (category: string) => Promise<void>
}

export function MobileCelebRanking({ ranking, categoryImages, votedCategory, pendingCategory, feedback, onVote }: Props) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const update = () => { if (window.innerWidth >= 900) setOpen(false) }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open])

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger className="mobile-ranking-trigger" aria-label="셀럽 랭킹 및 투표 열기">
      <Crown size={21} strokeWidth={1.8} aria-hidden="true" />
      <span>랭킹</span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="mobile-ranking-dim" />
      <Dialog.Content className="mobile-ranking-sheet">
        <div className="mobile-ranking-handle" aria-hidden="true" />
        <header className="mobile-ranking-heading">
          <div><span className="mobile-ranking-eyebrow"><Crown size={12} /> CELEB RANKING</span>
            <Dialog.Title>오늘의 최애에게<span>마음을 한 표</span></Dialog.Title>
          </div>
          <Dialog.Close className="mobile-ranking-close" aria-label="셀럽 랭킹 닫기"><X size={20} /></Dialog.Close>
        </header>
        <Dialog.Description className="mobile-ranking-description">하루 한 번, 응원하는 셀럽을 골라주세요.</Dialog.Description>
        <div className="mobile-ranking-scroll">
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
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
