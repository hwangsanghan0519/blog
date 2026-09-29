import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Crown, Heart, Images, RotateCw, Search, Shuffle, Sparkles, UsersRound, X } from 'lucide-react'
import type { Post } from '../../../entities/post/model/types'
import { getCategoryPath, getProductPath } from '../../../shared/lib/seo'
import { normalizeProductSearch, searchProductTitles } from '../lib/productSearch'
import { parseDesktopCollection, POCA_COLLECTION_KEY, shuffleDesktopCards } from '../lib/desktopCollection'

const desktopQuery = '(min-width: 900px)'
function subscribeDesktop(callback: () => void) {
  const media = window.matchMedia(desktopQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const getDesktopSnapshot = () => window.matchMedia(desktopQuery).matches
const getServerSnapshot = () => false
function useDesktopViewport() { return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerSnapshot) }

type Props = {
  posts: Post[]
  celebrities: string[]
  categoryImages: Record<string, string>
  onSelectPost: (id: string, list: string) => void
  onSelectCategory: (category: string) => void
  onShowRanking: () => void
  hasRanking: boolean
}
type View = 'search' | 'directory' | 'poca'
const searchSuggestions = ['블라우스', '가방', '운동화', '향수', '립', '재킷', '셔츠', '선글라스', '크림', '원피스']
function useSearchSuggestions(posts: Post[]) {
  return useMemo(() => searchSuggestions.filter(term => posts.some(post => post.status === 'published' && normalizeProductSearch(post.title).includes(term))).slice(0, 6), [posts])
}
const views = [
  { id: 'search', label: '상품 검색', icon: Search },
  { id: 'directory', label: '전체 셀럽', icon: UsersRound },
  { id: 'poca', label: '셀럽포카', icon: Images },
] as const

// Mount no desktop UI, effects or collection state below the existing mobile breakpoint.
export function DesktopDiscovery(props: Props) {
  return useDesktopViewport() ? <Discovery {...props} /> : null
}

function Discovery({ posts, celebrities, categoryImages, onSelectPost, onSelectCategory, onShowRanking, hasRanking }: Props) {
  const [view, setView] = useState<View>('search')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const suggestions = useSearchSuggestions(posts)
  const triggerRef = useRef<HTMLElement | null>(null)
  const navigating = useRef(false)
  const show = (next: View, trigger: HTMLElement) => {
    triggerRef.current = trigger
    navigating.current = false
    setView(next)
    setOpen(true)
  }
  const selectPost = (id: string, list: string) => { navigating.current = true; setOpen(false); onSelectPost(id, list) }
  const selectCategory = (name: string) => { navigating.current = true; setOpen(false); onSelectCategory(name) }

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <div className="desktop-discovery-bar">
      <label className="desktop-search-intro" htmlFor="desktop-product-query"><span>PICK FINDER</span><strong>찾고 있던 셀럽템,<br />여기서 검색해보세요</strong></label>
      <div className="desktop-search-entry">
        <form role="search" className="desktop-discovery-search desktop-product-search-form" onSubmit={event => { event.preventDefault(); show('search', searchRef.current!) }}>
          <Search size={24} aria-hidden="true" />
          <input ref={searchRef} id="desktop-product-query" type="search" aria-label="상품 제목 검색" placeholder="상품명으로 검색해보세요" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" spellCheck={false} enterKeyHint="search" />
          {query && <button className="desktop-search-clear" type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); searchRef.current?.focus() }}><X size={19} /></button>}
          <button className="desktop-search-submit" type="submit">검색 <ArrowUpRight size={18} aria-hidden="true" /></button>
        </form>
        {suggestions.length > 0 && <div className="desktop-search-quick" aria-label="추천 검색어"><span>추천 검색</span>{suggestions.map(term => <button key={term} type="button" onClick={event => { setQuery(term); show('search', event.currentTarget) }}>#{term}</button>)}</div>}
      </div>
    </div>
    <nav className="desktop-discovery-floating" aria-label="데스크톱 바로가기">
      <button type="button" aria-label="전체 셀럽 열기" aria-haspopup="dialog" onClick={event => show('directory', event.currentTarget)}><UsersRound size={23} aria-hidden="true" /><span>전체 셀럽</span></button>
      {hasRanking && <button type="button" onClick={onShowRanking}><Crown size={23} aria-hidden="true" /><span>랭킹·투표</span></button>}
      <button className="desktop-discovery-poca-trigger" type="button" aria-label="셀럽포카 열기" aria-haspopup="dialog" onClick={event => show('poca', event.currentTarget)}><span className="desktop-discovery-card-icon" aria-hidden="true"><i /><i /><i><Heart size={13} /></i></span><span>셀럽포카</span></button>
    </nav>
    <Dialog.Portal>
      <Dialog.Overlay className="desktop-discovery-overlay" />
      <Dialog.Content className={`desktop-discovery-dialog is-${view}`} onCloseAutoFocus={event => {
        event.preventDefault()
        if (!navigating.current) triggerRef.current?.focus({ preventScroll: true })
      }}>
        <header className="desktop-discovery-heading">
          <div><span>POWER PUFF CELEB</span><Dialog.Title>{views.find(item => item.id === view)?.label}</Dialog.Title>
            <Dialog.Description>{view === 'search' ? '찾고 있던 셀럽의 아이템을 상품명으로 만나보세요.' : view === 'directory' ? '최애 셀럽을 선택하고 착장과 아이템을 한눈에 둘러보세요.' : '마음에 드는 순간을 포토카드로 소장해보세요.'}</Dialog.Description></div>
          <Dialog.Close className="desktop-discovery-close" aria-label="탐색 창 닫기"><X size={22} /></Dialog.Close>
        </header>
        {view === 'search' && <DesktopSearch posts={posts} query={query} onQuery={setQuery} onSelect={id => selectPost(id, 'search')} />}
        {view === 'directory' && <DesktopDirectory celebrities={celebrities} images={categoryImages} posts={posts} onSelect={selectCategory} />}
        {view === 'poca' && <DesktopAlbum posts={posts} onSelect={id => selectPost(id, 'poca')} />}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function DesktopSearch({ posts, query, onQuery, onSelect }: { posts: Post[]; query: string; onQuery: (query: string) => void; onSelect: (id: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const hasQuery = Boolean(query.trim())
  const results = useMemo(() => hasQuery ? searchProductTitles(posts, query) : posts.slice(0, 12), [hasQuery, posts, query])
  const suggestions = useSearchSuggestions(posts)
  useEffect(() => { inputRef.current?.focus() }, [])
  return <div className="desktop-discovery-body">
    <form role="search" className="desktop-discovery-search desktop-product-search-form is-large" onSubmit={event => { event.preventDefault(); resultsRef.current?.focus() }}>
      <Search size={24} aria-hidden="true" /><input ref={inputRef} type="search" aria-label="탐색 창 상품 제목 검색" placeholder="상품명으로 검색해보세요" value={query} onChange={event => onQuery(event.target.value)} autoComplete="off" spellCheck={false} enterKeyHint="search" />
      {query && <button className="desktop-search-clear" type="button" aria-label="검색어 지우기" onClick={() => { onQuery(''); inputRef.current?.focus() }}><X size={18} /></button>}
      <button className="desktop-search-submit" type="submit">검색 <ArrowUpRight size={18} aria-hidden="true" /></button>
    </form>
    {suggestions.length > 0 && <div className="desktop-discovery-keywords" aria-label="추천 검색어">{suggestions.map(term => <button key={term} type="button" aria-pressed={query === term} onClick={() => onQuery(term)}>#{term}</button>)}</div>}
    <div className="desktop-discovery-results-head" role="status" aria-atomic="true"><strong>{hasQuery ? <><span className="desktop-search-query">‘{query.trim()}’</span> 검색 결과</> : '최근 올라온 아이템'}</strong><span>{results.length}개</span></div>
    <div ref={resultsRef} className="desktop-discovery-scroll" key={query} tabIndex={-1} aria-label="상품 검색 결과">
      {results.length ? <ul className="desktop-search-grid">{results.map(post => <li key={post.id}><a href={getProductPath(post.slug || post.id)} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault(); onSelect(post.id)
      }}><DesktopImage src={post.coverImage} label={post.title} /><div><small>{post.category || 'CELEB PICK'}</small><strong>{post.title}</strong><span>상품 자세히 보기 <ArrowUpRight size={15} /></span></div></a></li>)}</ul>
        : <div className="desktop-discovery-empty"><Search size={32} /><strong>{hasQuery ? '검색 결과가 없어요' : '새로운 아이템을 준비 중이에요'}</strong><p>조금 더 짧은 상품명이나 다른 단어로 찾아보세요.</p>{hasQuery && <button type="button" onClick={() => { onQuery(''); inputRef.current?.focus() }}>검색어 초기화</button>}</div>}
    </div>
  </div>
}

function DesktopDirectory({ celebrities, images, posts, onSelect }: { celebrities: string[]; images: Record<string, string>; posts: Post[]; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState('')
  const names = celebrities.filter(name => normalizeProductSearch(name).includes(normalizeProductSearch(query)))
  const counts = useMemo(() => posts.reduce<Record<string, number>>((result, post) => { result[post.category] = (result[post.category] ?? 0) + 1; return result }, {}), [posts])
  return <div className="desktop-discovery-body">
    <div className="desktop-discovery-search is-large"><Search size={20} /><input type="search" aria-label="셀럽 이름 검색" placeholder="최애 셀럽의 이름을 검색하세요" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="셀럽 검색어 지우기" onClick={() => setQuery('')}><X size={18} /></button>}</div>
    <div className="desktop-discovery-results-head" role="status"><strong>전체 셀럽</strong><span>{names.length}명</span></div>
    <div className="desktop-discovery-scroll">
      {names.length ? <ul className="desktop-directory-grid">{names.map(name => <li key={name}><a href={getCategoryPath(name)} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault(); onSelect(name)
      }}><DesktopImage src={images[name]} label={name} /><strong>{name}<ArrowUpRight size={19} aria-hidden="true" /></strong><small>{counts[name] ?? 0}개의 아이템</small></a></li>)}</ul>
        : <div className="desktop-discovery-empty"><UsersRound size={32} /><strong>찾는 셀럽이 없어요</strong><p>다른 이름으로 검색해보세요.</p></div>}
    </div>
  </div>
}

function readSavedCards() {
  try { return parseDesktopCollection(localStorage.getItem(POCA_COLLECTION_KEY)) } catch { return [] }
}

function DesktopAlbum({ posts, onSelect }: { posts: Post[]; onSelect: (id: string) => void }) {
  const [savedIds, setSavedIds] = useState(readSavedCards)
  const [collectionOnly, setCollectionOnly] = useState(false)
  const [order, setOrder] = useState<string[]>([])
  const [activeId, setActiveId] = useState('')
  const [flipped, setFlipped] = useState(false)
  const [notice, setNotice] = useState('')
  const covers = useMemo(() => posts.filter(post => post.coverImage.trim()), [posts])
  const saved = new Set(savedIds)
  const collected = covers.filter(post => saved.has(post.id))
  const positions = new Map(order.map((id, index) => [id, index]))
  const cards = [...(collectionOnly ? collected : covers)].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity))
  const activeIndex = Math.max(0, cards.findIndex(post => post.id === activeId))
  const current = cards[activeIndex]
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === POCA_COLLECTION_KEY || event.key === null) setSavedIds(readSavedCards()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const select = (id: string) => { setActiveId(id); setFlipped(false) }
  const move = (step: number) => { if (cards.length) select(cards[(activeIndex + step + cards.length) % cards.length].id) }
  const toggleSave = () => {
    if (!current) return
    if (!saved.has(current.id) && savedIds.length >= 2000) { setNotice('소장함이 가득 찼어요. 다른 카드의 소장을 해제해주세요.'); return }
    const next = saved.has(current.id) ? savedIds.filter(id => id !== current.id) : [...savedIds, current.id]
    setSavedIds(next)
    setFlipped(false)
    try { localStorage.setItem(POCA_COLLECTION_KEY, JSON.stringify(next)); setNotice(saved.has(current.id) ? '소장을 해제했어요' : '이 기기에 소장했어요') }
    catch { setNotice('지금은 이 창에서만 소장할 수 있어요') }
  }
  return <div className="desktop-discovery-body desktop-album-body">
    <div className="desktop-album-toolbar"><div>{[false, true].map(only => <button key={String(only)} type="button" aria-pressed={collectionOnly === only} onClick={() => { setCollectionOnly(only); select(''); setNotice('') }}>{only ? <Heart size={15} /> : <Images size={15} />}{only ? '소장' : '전체'} <span>{only ? collected.length : covers.length}</span></button>)}</div>
      <button type="button" disabled={cards.length < 2} onClick={() => { const next = shuffleDesktopCards(cards.map(post => post.id)); setOrder(next); select(next[0]); setNotice('카드를 섞었어요') }}><Shuffle size={16} />카드 섞기</button>
    </div>
    {current ? <div className="desktop-album-layout">
      <div className="desktop-album-stage" role="region" aria-label="포토카드 미리보기" tabIndex={0} onKeyDown={event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1) }
      }}>
        <button className={`desktop-photo-card${flipped ? ' is-flipped' : ''}`} type="button" aria-label={`포토카드 ${flipped ? '앞면' : '뒷면'} 보기`} onClick={() => setFlipped(value => !value)}>
          {flipped ? <span className="desktop-photo-back"><small>PPC COLLECTION</small><Heart size={34} /><strong>{current.category || 'CELEB PICK'}</strong><b>{current.title}</b><span>{current.excerpt || '최애의 착장을 내 마음속에 저장'}</span><small>POWER PUFF CELEB</small></span>
            : <><DesktopImage src={current.coverImage} label={current.title} /><span className="desktop-photo-series">PPC / PHOTO CARD <Sparkles size={14} /></span><span className="desktop-photo-signature"><small>Who's your bias?</small><strong>{current.category || 'CELEB PICK'}</strong><Heart size={23} fill={saved.has(current.id) ? 'currentColor' : 'none'} /></span><span className="desktop-photo-caption">KEEP THIS MOMENT · POWER PUFF CELEB</span></>}
        </button>
        <div className="desktop-album-navigation"><button type="button" aria-label="이전 포토카드" disabled={cards.length < 2} onClick={() => move(-1)}><ChevronLeft size={20} /></button><span aria-live="polite">{activeIndex + 1} / {cards.length}</span><button type="button" aria-label="다음 포토카드" disabled={cards.length < 2} onClick={() => move(1)}><ChevronRight size={20} /></button></div>
      </div>
      <div className="desktop-album-details">
        <span className="desktop-album-celeb"><Heart size={18} aria-hidden="true" />{current.category || 'CELEB PICK'}<small>PHOTO CARD</small></span><h3>{current.title}</h3><p>{current.excerpt || '마음에 드는 셀럽의 아이템을 자세히 만나보세요.'}</p>
        <div className="desktop-album-actions"><button type="button" aria-pressed={saved.has(current.id)} onClick={toggleSave}>{saved.has(current.id) ? <Check size={18} /> : <Heart size={18} />}{saved.has(current.id) ? '소장 해제' : '포토카드 소장하기'}</button><button type="button" aria-label="포토카드 뒤집기" aria-pressed={flipped} onClick={() => setFlipped(value => !value)}><RotateCw size={18} />뒤집기</button></div>
        <a className="desktop-album-product" href={getProductPath(current.slug || current.id)} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onSelect(current.id) }}>착장 보러가기 <ArrowUpRight size={17} /></a>
        <div className="desktop-album-thumbnails" aria-label="포토카드 선택">{cards.map((post, index) => <button key={post.id} type="button" aria-label={`${index + 1}번 ${post.category} 포토카드`} aria-pressed={post.id === current.id} onClick={() => select(post.id)}><DesktopImage src={post.coverImage} label={post.title} />{saved.has(post.id) && <Heart size={12} fill="currentColor" />}</button>)}</div>
        <small className="desktop-album-tip">카드를 클릭하면 뒤집혀요 · ← → 키로 이동할 수 있어요</small>
      </div>
    </div> : <div className="desktop-discovery-empty"><Heart size={36} /><strong>{collectionOnly ? '아직 소장한 카드가 없어요' : '새로운 포토카드를 준비 중이에요'}</strong><p>마음에 드는 포토카드를 이 기기에 소장할 수 있어요.</p>{collectionOnly && <button type="button" onClick={() => setCollectionOnly(false)}>전체 카드 둘러보기</button>}</div>}
    <p className="desktop-album-notice" role="status">{notice || '소장한 카드는 현재 브라우저에 저장돼요.'}</p>
  </div>
}

function DesktopImage({ src, label }: { src?: string; label: string }) {
  const [failed, setFailed] = useState('')
  return src && src !== failed ? <img src={src} alt={label} loading="lazy" decoding="async" onError={() => setFailed(src)} /> : <span className="desktop-image-fallback" aria-label={label}><Sparkles size={26} /><span>{label.slice(0, 2)}</span></span>
}
