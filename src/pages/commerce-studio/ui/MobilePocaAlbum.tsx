import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUpRight, ChevronLeft, ChevronRight, Heart, RotateCw, Shuffle, Sparkles, Star, X } from 'lucide-react'
import { useKeenSlider } from 'keen-slider/react'
import type { Post } from '../../../entities/post/model/types'
import { getProductPath } from '../../../shared/lib/seo'
import 'keen-slider/keen-slider.min.css'
import './MobilePocaAlbum.css'

const COLLECTION_KEY = 'powerpuffceleb:poca-collection:v1'

function readCollection(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLECTION_KEY) ?? '[]')
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))].slice(0, 2000) : []
  } catch { return [] }
}

type Props = { posts: Post[]; onSelect: (postId: string) => void }

export function MobilePocaAlbum({ posts, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const openingProduct = useRef(false)
  const covers = useMemo(() => posts.filter(post => post.status === 'published' && post.coverImage.trim()), [posts])

  useEffect(() => {
    if (!open) return
    const desktop = window.matchMedia('(min-width: 900px)')
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    closeOnDesktop()
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [open])

  if (!covers.length) return null

  return <Dialog.Root open={open} onOpenChange={next => { openingProduct.current = false; setOpen(next) }}>
    <Dialog.Trigger className="mobile-poca-trigger" aria-label="셀럽포카 열기">
      <span className="poca-trigger-cards" aria-hidden="true"><i /><i /><i><Heart size={15} fill="currentColor" /></i><Sparkles size={14} /></span>
      <span className="poca-trigger-label">셀럽포카</span>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="poca-overlay" />
      <Dialog.Content className="poca-album" onCloseAutoFocus={event => { if (openingProduct.current) event.preventDefault() }}>
        <div className="poca-paper-stars" aria-hidden="true"><Star /><Sparkles /><Star /></div>
        <header className="poca-header">
          <Dialog.Title><Sparkles size={19} aria-hidden="true" /> 포토카드</Dialog.Title>
          <Dialog.Close className="poca-close" aria-label="포토카드 닫기"><X size={21} /></Dialog.Close>
        </header>
        <div className="poca-bias-intro">
          <p>Who’s your <em>bias?</em><Heart size={13} aria-hidden="true" /></p>
          <Dialog.Description>최애의 착장을,<br />내 마음속에 저장</Dialog.Description>
        </div>
        {open && <PocaCollection posts={covers} onSelect={postId => { openingProduct.current = true; setOpen(false); onSelect(postId) }} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function PocaCollection({ posts, onSelect }: Props) {
  const [savedIds, setSavedIds] = useState(readCollection)
  const [collectionOnly, setCollectionOnly] = useState(false)
  const [order, setOrder] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const saved = useMemo(() => new Set(savedIds), [savedIds])
  const collected = posts.filter(post => saved.has(post.id))
  const available = collectionOnly ? collected : posts
  const positions = new Map(order.map((id, index) => [id, index]))
  const cards = order.length ? [...available].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity)) : available

  const toggleSave = (id: string) => {
    const next = saved.has(id) ? savedIds.filter(value => value !== id) : [...savedIds, id]
    setSavedIds(next)
    try {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(next))
      setNotice(saved.has(id) ? '소장을 해제했어요' : '이 기기에 소장했어요')
    } catch { setNotice('지금은 이 창에서만 소장할 수 있어요') }
  }

  const shuffle = () => {
    const ids = cards.map(post => post.id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
    }
    if (ids.length > 1 && ids.every((id, index) => id === cards[index].id)) ids.push(ids.shift()!)
    setOrder(ids)
    setNotice('카드를 섞었어요')
  }

  return <>
    <div className="poca-tabs" aria-label="포토카드 모아보기">
      <button type="button" aria-pressed={!collectionOnly} onClick={() => { setCollectionOnly(false); setNotice('') }}>전체 <span>{posts.length}</span></button>
      <button type="button" aria-pressed={collectionOnly} onClick={() => { setCollectionOnly(true); setNotice('') }}><Heart size={13} /> 소장 <span>{collected.length}</span></button>
    </div>
    {cards.length ? <PocaDeck key={cards.map(post => post.id).join('|')} cards={cards} saved={saved} onToggleSave={toggleSave} onShuffle={shuffle} onSelect={onSelect} />
      : <div className="poca-empty"><span><Heart size={36} /></span><strong>아직 소장한 카드가 없어요</strong><p>마음에 드는 카드에 하트를 눌러보세요.</p><button type="button" onClick={() => setCollectionOnly(false)}>카드 둘러보기 <ArrowUpRight size={16} /></button></div>}
    <p className="poca-notice" role="status">{notice}</p>
  </>
}

type DeckProps = { cards: Post[]; saved: Set<string>; onToggleSave: (id: string) => void; onShuffle: () => void; onSelect: (id: string) => void }

function PocaDeck({ cards, saved, onToggleSave, onShuffle, onSelect }: DeckProps) {
  const [active, setActive] = useState(0)
  const activeIndex = useRef(0)
  const [flipped, setFlipped] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragOrigin = useRef(0)
  const dragEnd = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>({
    loop: cards.length > 1,
    slides: { origin: 'center', perView: 'auto', spacing: 18 },
    defaultAnimation: { duration: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 480 },
    slideChanged(instance) {
      const next = instance.track.details.rel
      if (next === activeIndex.current) return
      activeIndex.current = next
      if (instance.container.contains(document.activeElement)) stageRef.current?.focus({ preventScroll: true })
      setActive(next)
      setFlipped(false)
    },
    dragStarted(instance) { clearTimeout(dragEnd.current); dragging.current = false; dragOrigin.current = instance.track.details.position },
    dragged(instance) { if (Math.abs(instance.track.details.position - dragOrigin.current) > .015) dragging.current = true },
    dragEnded() { if (dragging.current) dragEnd.current = setTimeout(() => { dragging.current = false }, 120) },
  })
  useEffect(() => () => clearTimeout(dragEnd.current), [])
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const resize = () => {
      // Fit the card into the actual space left after the header and controls.
      const width = Math.min(stage.clientWidth * .72, 300, Math.max(0, stage.clientHeight - 28) * .68)
      if (stage.style.getPropertyValue('--poca-card-width') === `${width}px`) return
      stage.style.setProperty('--poca-card-width', `${width}px`)
      slider.current?.update()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [slider])
  const current = cards[active] ?? cards[0]
  const flip = () => {
    if (dragging.current) return
    if (stageRef.current?.contains(document.activeElement)) stageRef.current.focus({ preventScroll: true })
    setFlipped(value => !value)
  }

  return <>
    <div ref={stageRef} tabIndex={-1} className="poca-stage" role="region" aria-label="포토카드 슬라이드" aria-roledescription="캐러셀" onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); slider.current?.next() }
      if (event.key === 'ArrowLeft') { event.preventDefault(); slider.current?.prev() }
    }}>
      <div ref={sliderRef} className="keen-slider poca-slider">
        {cards.map((post, index) => <div key={post.id} className={`keen-slider__slide poca-slide${active === index ? ' is-active' : ''}`} aria-hidden={active !== index}>
          <div className={`poca-card${active === index && flipped ? ' is-flipped' : ''}`}>
            <div className="poca-card-rotator">
              <button type="button" className="poca-card-front" aria-label={`${post.category || '셀럽'} 포토카드 뒷면 보기`} tabIndex={active === index && !flipped ? 0 : -1} inert={active !== index || flipped} aria-hidden={active === index && flipped} onClick={flip}>
                <span className="poca-foil" />
                <span className="poca-photo"><PocaCover src={post.coverImage} title={post.title} priority={index === 0} /><span className="poca-photo-wash" /></span>
                <span className="poca-card-series">PPC <i>✦</i> PHOTO CARD</span>
                <span className="poca-card-number">NO. {String(index + 1).padStart(3, '0')}</span>
                <span className="poca-card-signature"><small>celeb</small><strong>{post.category || 'CELEB PICK'}</strong><Heart size={23} fill={saved.has(post.id) ? 'currentColor' : 'none'} /></span>
                <span className="poca-card-bottom"><span>KEEP THIS MOMENT</span><span>✧ POWER PUFF CELEB</span></span>
                <span className="poca-card-glint" />
              </button>
              <div className="poca-card-back" inert={active !== index || !flipped} aria-hidden={!(active === index && flipped)}>
                <button type="button" className="poca-back-flip" aria-label={`${post.category || '셀럽'} 포토카드 앞면 보기`} tabIndex={active === index && flipped ? 0 : -1} onClick={flip} />
                <span className="poca-back-top">PPC COLLECTION <Star size={14} /></span>
                <span className="poca-back-monogram" aria-hidden="true">P<Heart size={18} fill="currentColor" />C</span>
                <span className="poca-back-name">{post.category || 'CELEB PICK'}</span>
                <span className="poca-back-rule" />
                <PocaBackDetails post={post} active={active === index && flipped} />
                <a className="poca-back-link" data-keen-slider-clickable="true" tabIndex={active === index && flipped ? 0 : -1} href={getProductPath(post.slug || post.id)} aria-label={`${post.title} 착장 보러가기`} onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault(); onSelect(post.id)
                }}>착장 보러가기 <ArrowUpRight size={14} /></a>
                <span className="poca-back-foot">POWER PUFF CELEB</span>
              </div>
            </div>
          </div>
        </div>)}
      </div>
    </div>
    <div className="poca-slide-navigation">
      <button type="button" onClick={() => slider.current?.prev()} disabled={cards.length < 2} aria-label="이전 포토카드"><ChevronLeft size={19} /></button>
      <span className="poca-page-count" aria-live="polite" aria-atomic="true">{String(active + 1).padStart(2, '0')} <span>/ {String(cards.length).padStart(2, '0')}</span></span>
      <button type="button" onClick={() => slider.current?.next()} disabled={cards.length < 2} aria-label="다음 포토카드"><ChevronRight size={19} /></button>
    </div>
    <div className="poca-actions">
      <button type="button" className="poca-shuffle" aria-label="포토카드 섞기" onClick={onShuffle} disabled={cards.length < 2}><Shuffle size={20} /></button>
      <button type="button" className={`poca-save${saved.has(current.id) ? ' is-saved' : ''}`} aria-label={saved.has(current.id) ? '포토카드 소장 해제' : '포토카드 소장하기'} aria-pressed={saved.has(current.id)} onClick={() => onToggleSave(current.id)}><Heart size={25} fill={saved.has(current.id) ? 'currentColor' : 'none'} /></button>
      <button type="button" className="poca-flip" aria-label="포토카드 뒤집기" aria-pressed={flipped} onClick={flip}><RotateCw size={20} /></button>
    </div>
    <p className="poca-hint">{flipped ? '밀어서 다음 포카 해제' : '포카를 누르면 뒷면이 나올 거예요'}</p>
  </>
}

function PocaBackDetails({ post, active }: { post: Post; active: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const [layout, setLayout] = useState({ count: 1, step: 0 })

  useLayoutEffect(() => {
    if (!active) return
    const viewport = viewportRef.current
    const copy = copyRef.current
    if (!viewport || !copy) return
    let disposed = false
    setPage(0)
    const measure = () => {
      if (disposed) return
      const width = parseFloat(getComputedStyle(viewport).width)
      const gap = parseFloat(getComputedStyle(copy).columnGap) || 0
      if (width <= 0) return
      const step = width + gap
      const count = Math.max(1, Math.ceil((copy.scrollWidth + gap - 1) / step))
      setLayout({ count, step })
      setPage(current => Math.min(current, count - 1))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    // Font loading can change the number of text pages without resizing the card.
    document.fonts.addEventListener('loadingdone', measure)
    void document.fonts.ready.then(measure)
    return () => { disposed = true; observer.disconnect(); document.fonts.removeEventListener('loadingdone', measure) }
  }, [active, post.title, post.excerpt])

  return <div className="poca-back-details">
    <div ref={viewportRef} className="poca-back-copy-viewport">
      <div ref={copyRef} className="poca-back-copy" style={{ transform: `translateX(${-page * layout.step}px)` }}>
        <h3 className="poca-back-title">{post.title}</h3>
        {post.excerpt.trim() && <p className="poca-back-summary">{post.excerpt}</p>}
      </div>
    </div>
    <div className="poca-copy-navigation" data-keen-slider-clickable="true" style={{ visibility: layout.count > 1 ? 'visible' : 'hidden' }} onKeyDown={event => event.stopPropagation()}>
      <button type="button" aria-label="이전 상품 설명" disabled={!active || page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}><ChevronLeft size={14} /></button>
      <span aria-live={active ? 'polite' : 'off'} aria-atomic="true">설명 {page + 1} / {layout.count}</span>
      <button type="button" aria-label="다음 상품 설명" disabled={!active || page >= layout.count - 1} onClick={() => setPage(current => Math.min(layout.count - 1, current + 1))}><ChevronRight size={14} /></button>
    </div>
  </div>
}

function PocaCover({ src, title, priority }: { src: string; title: string; priority: boolean }) {
  const [failed, setFailed] = useState(false)
  return failed ? <span className="poca-image-error"><Sparkles size={30} /><span>사진을 불러오지 못했어요<br />다음 카드를 만나 보세요</span></span>
    : <img src={src} alt={title} loading={priority ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => setFailed(true)} />
}
