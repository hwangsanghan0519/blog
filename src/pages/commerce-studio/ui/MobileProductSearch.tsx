import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import type { Post } from '../../../entities/post/model/types'
import { getProductPath } from '../../../shared/lib/seo'
import { normalizeProductSearch, searchProductTitles } from '../lib/productSearch'
import './MobileProductSearch.css'

const SUGGESTIONS = ['블라우스', '가방', '운동화', '향수', '립', '재킷', '셔츠', '선글라스', '크림', '원피스']

export function MobileProductSearch({ posts, onSelect }: { posts: Post[]; onSelect: (postId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [viewport, setViewport] = useState({ height: 0, bottom: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const openingProduct = useRef(false)
  const results = useMemo(() => searchProductTitles(posts, query), [posts, query])
  const suggestions = useMemo(() => SUGGESTIONS.filter((term) => posts.some((post) => post.status === 'published' && normalizeProductSearch(post.title).includes(term))).slice(0, 6), [posts])
  const hasQuery = Boolean(query.trim())
  const displayed = hasQuery ? results : posts.filter((post) => post.status === 'published').slice(0, 6)

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

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { openingProduct.current = false; setOpen(next) }}>
      <Dialog.Trigger className="mobile-search-trigger" aria-label="상품 제목 검색 열기">
        <Search size={22} strokeWidth={2.2} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mobile-search-overlay" />
        <Dialog.Content className="mobile-product-search" data-compact={viewport.height > 0 && viewport.height < 520 ? '' : undefined} style={viewport.height ? {
          '--search-viewport-height': `${viewport.height}px`, '--search-keyboard-offset': `${viewport.bottom}px`,
        } as CSSProperties : undefined} onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus() }} onCloseAutoFocus={(event) => { if (openingProduct.current) event.preventDefault() }}>
          <div className="mobile-search-handle" aria-hidden="true" />
          <header className="mobile-search-header">
            <div><span className="mobile-search-eyebrow"><Sparkles size={13} aria-hidden="true" /> PICK FINDER</span>
              <Dialog.Title>밤새 찾아 헤매던<span>셀럽템을 검색해보세요</span></Dialog.Title>
            </div>
            <Dialog.Close className="mobile-search-close" aria-label="상품 검색 닫기"><X size={21} /></Dialog.Close>
          </header>
          <Dialog.Description className="mobile-search-description">셀럽의 이름이나 상품명으로 쉽게 찾을 수 있어요</Dialog.Description>
          <form className="mobile-search-form" role="search" onSubmit={(event) => { event.preventDefault(); inputRef.current?.blur() }}>
            <Search size={21} aria-hidden="true" />
            <input ref={inputRef} type="search" aria-label="상품 제목 검색" placeholder="어떤 아이템을 찾으세요?" value={query}
              onChange={(event) => setQuery(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" />
            {query && <button type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); inputRef.current?.focus() }}><X size={17} /></button>}
          </form>
          {!hasQuery && suggestions.length > 0 && <div className="mobile-search-suggestions" aria-label="제목에서 찾은 추천 검색어">
            {suggestions.map((term) => <button type="button" key={term} onClick={() => setQuery(term)}>#{term}</button>)}
          </div>}
          <div className="mobile-search-results-heading" aria-live="polite" aria-atomic="true">
            <strong>{hasQuery ? '찾은 아이템' : '최근 올라온 아이템'}</strong><span>{hasQuery ? `${results.length}개` : '먼저 둘러보세요'}<Sparkles size={12} aria-hidden="true" /></span>
          </div>
          <div className="mobile-search-results" key={query}>
            {displayed.length ? <ul>{displayed.map((post, index) => <li key={post.id}>
              <a href={getProductPath(post.slug || post.id)} onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault(); openingProduct.current = true; setOpen(false); onSelect(post.id)
              }}>
                <div className="mobile-search-thumbnail">{post.coverImage ? <img src={post.coverImage} alt="" loading="lazy" decoding="async" /> : <Sparkles aria-hidden="true" />}<span>{String(index + 1).padStart(2, '0')}</span></div>
                <div className="mobile-search-result-copy">{post.category && <small>{post.category}</small>}<strong><HighlightedTitle title={post.title} query={query} /></strong><span>상품 자세히 보기 <ArrowRight size={13} aria-hidden="true" /></span></div>
              </a>
            </li>)}</ul> : <div className="mobile-search-empty"><Search size={34} aria-hidden="true" /><strong>{hasQuery ? '아직 발견하지 못했어요' : '새로운 아이템을 준비 중이에요'}</strong>
              <p>{hasQuery ? '조금 더 짧은 상품명이나 다른 단어로 찾아보세요.' : '상품이 올라오면 여기서 바로 찾아볼 수 있어요.'}</p>
              {hasQuery && <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }}>다시 찾아보기 <ArrowRight size={15} /></button>}
            </div>}
          </div>
          <footer className="mobile-search-footer">셀럽과 팬들에게 힘을 주는<span>POWER PUFF CELEB</span></footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return title
  const matcher = new RegExp(`(${terms.join('|')})`, 'gi')
  return title.split(matcher).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)
}
