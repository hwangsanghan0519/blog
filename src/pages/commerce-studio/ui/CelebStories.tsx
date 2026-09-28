import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Heart, Pause, Play, Sparkles } from 'lucide-react'
import { InstagramSourceIcon } from '../../../entities/post/ui/ProductSourceIcons'
import { fetchCelebStories } from '../api/celebStoryApi'
import { DEFAULT_CELEB_ACCOUNTS, formatFollowers } from '../model/celebAccounts'
import { retainProfile } from '../model/celebProfileCache'
import type { CelebAccount, CelebStoryFeed } from '../model/celebStoryTypes'
import { getCategoryPath } from '../../../shared/lib/seo'
import './celeb-stories.css'

type Props = { categoryImages: Record<string, string>; accounts?: CelebAccount[] }

export function CelebStories({ categoryImages, accounts = DEFAULT_CELEB_ACCOUNTS }: Props) {
  const [profiles, setProfiles] = useState<Record<string, CelebStoryFeed>>({})
  const [busy, setBusy] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const [hasEntered, setHasEntered] = useState(false)
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)
  const [motionPaused, setMotionPaused] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)
  const hasAccounts = accounts.length > 0

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const setVisible = (visible: boolean) => {
      setInView(visible)
      if (visible) setHasEntered(true)
    }
    // Mobile tab/BFCache restoration can retain an old observer result.
    const restore = () => {
      setPageVisible(document.visibilityState !== 'hidden')
      const bounds = section.getBoundingClientRect()
      setVisible(bounds.bottom > 0 && bounds.top < window.innerHeight)
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
    }, { threshold: 0 })
    observer?.observe(section)
    restore()
    window.addEventListener('pageshow', restore)
    document.addEventListener('visibilitychange', restore)
    if (!observer) window.addEventListener('scroll', restore, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('pageshow', restore)
      document.removeEventListener('visibilitychange', restore)
      window.removeEventListener('scroll', restore)
    }
  }, [hasAccounts])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const update = () => setCanScroll(nav.scrollWidth > nav.clientWidth + 1)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [accounts])

  useEffect(() => {
    let mounted = true
    let pending = false
    const controllers = new Set<AbortController>()
    const getProfile = async (username: string) => {
      const controller = new AbortController()
      controllers.add(controller)
      const timeout = setTimeout(() => controller.abort(), 15_000)
      try { return await fetchCelebStories(username, controller.signal) }
      finally { clearTimeout(timeout); controllers.delete(controller) }
    }
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      setBusy(true)
      try {
        const queue = [...accounts]
        const worker = async () => {
          while (mounted && queue.length) {
            const account = queue.shift()!
            let profile: CelebStoryFeed | undefined
            try {
              profile = await getProfile(account.username)
              if (profile.account.username !== account.username) profile = undefined
            } catch { /* Keep the last successful value until recovery or page reload. */ }
            if (!mounted) return
            const next = profile
            setProfiles(previous => {
              const kept = retainProfile(previous[account.username], next)
              const result = { ...previous }
              if (kept) result[account.username] = kept
              else delete result[account.username]
              return result
            })
          }
        }
        await Promise.all([worker(), worker()])
      } catch { /* The next visible refresh retries without clearing successful profiles. */ }

      finally {
        pending = false
        if (mounted) setBusy(false)
      }
    }
    void refresh()
    const timer = setInterval(() => void refresh(), 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mounted = false
      controllers.forEach((controller) => controller.abort())
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [accounts])

  if (!accounts.length) return null

  return (
    <section ref={sectionRef} className={`celeb-stories${hasEntered ? ' is-entered' : ''}${!inView ? ' is-offscreen' : ''}${!pageVisible ? ' is-page-hidden' : ''}${motionPaused ? ' is-motion-paused' : ''}`} aria-labelledby="instagram-live-title" style={{ '--celeb-columns': Math.min(accounts.length, 8) } as CSSProperties}>
      <div className="celeb-stories-atmosphere" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} style={{ '--particle-index': index } as CSSProperties}>{index % 2 ? <Sparkles /> : <Heart />}</span>)}
      </div>
      <header className="celeb-stories-heading">
        <div className="celeb-stories-title">
          <span className="celeb-stories-eyebrow" aria-hidden="true"><InstagramSourceIcon size={12} /> instagram</span>
          <h2 id="instagram-live-title" aria-label="인스타라이브"><span>인스타</span><em>{Array.from('라이브', (letter, index) => <span key={letter} style={{ '--letter-index': index } as CSSProperties}>{letter}</span>)}</em></h2>
          <span className="celeb-stories-handnote" aria-hidden="true">RealTime follower, Story Live<ArrowUpRight size={17} /></span>
        </div>
        <div className="celeb-stories-heading-end">
          <span className="celeb-stories-sticker" aria-hidden="true">TAP YOUR<br /><b>FAVE ↗</b></span>
          <button type="button" className="celeb-stories-motion" aria-label={motionPaused ? '인스타라이브 모션 재생' : '인스타라이브 모션 일시정지'} aria-pressed={motionPaused} onClick={() => setMotionPaused(value => !value)}>
            {motionPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
        </div>
      </header>
      <div className="celeb-stories-nav-wrap">
        <div className="celeb-stories-nav" ref={navRef} aria-busy={busy} aria-label="셀럽 Instagram 프로필">
          {accounts.map((account, index) => {
            const profile = profiles[account.username]
            const readable = profile?.state === 'ready' || profile?.state === 'stale'
            const count = readable ? profile.followers : null
            const loading = !profile && busy
            const followers = count != null ? formatFollowers(count) : loading ? '불러오는 중' : '집계 중'
            const unit = followers.match(/[만억]$/)?.[0] ?? ''
            return <a key={account.username} className="celeb-stories-person"
              style={{ '--celeb-enter-delay': `${Math.min(index, 7) * 75}ms`, '--celeb-phase': `${index * -.8}s`, '--card-tilt': `${[-5, 3, -3, 5, -2][index % 5]}deg`, '--card-offset': `${index % 2 ? 7 : 0}px` } as CSSProperties}
              href={`https://www.instagram.com/${account.username}/`} target="_blank" rel="noopener noreferrer"
              aria-label={`${account.name} 인스타그램 @${account.username}, 팔로워 ${followers}, 프로필 바로가기 (새 창)`}>
              {/* Decorative on every profile; never represents verified active stories. */}
              <span className="celeb-stories-tape" aria-hidden="true" />
              <span className="celeb-stories-portrait">
                <span className="celeb-stories-avatar"><span>
                  <ProfileImage src={profile?.profileImage || categoryImages[account.name]} name={account.name} />
                </span></span>
                <span className="celeb-stories-open" aria-hidden="true"><ArrowUpRight size={12} /></span>
              </span>
              <strong className="celeb-stories-name">{account.name}</strong>
              <span className="celeb-stories-username">@{account.username}</span>
              <span className={`celeb-stories-followers${count == null ? ' is-unknown' : ''}${loading ? ' is-loading' : ''}`} title={count != null ? `팔로워 ${count.toLocaleString('ko-KR')}명${profile?.state === 'stale' ? ' · 마지막 확인 수치' : ''}` : loading ? '팔로워 수를 불러오고 있어요' : '집계 중 · Instagram에서 수치가 제공되면 표시됩니다'}>
                <span key={followers} className="celeb-stories-followers-number">{unit ? followers.slice(0, -1) : followers}</span>
                {unit && <small className="celeb-stories-followers-unit">{unit}</small>}
                {profile?.state === 'stale' && <i aria-label="마지막 확인 수치" />}
              </span>
            </a>
          })}
        </div>
        {canScroll && <div className="celeb-stories-nav-controls">
          <button type="button" aria-label="이전 셀럽 보기" onClick={() => navRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="다음 셀럽 보기" onClick={() => navRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}><ChevronRight size={16} /></button>
        </div>}
        <nav className="celeb-stories-picks" aria-label="인스타라이브 셀럽별 아이템">
          <span>CELEB PICK</span>
          {accounts.map((account) => <a key={account.username} href={getCategoryPath(account.name)}>{account.name}<ArrowUpRight size={10} aria-hidden="true" /></a>)}
        </nav>
      </div>
    </section>
  )
}

function ProfileImage({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState('')
  return src && failedSrc !== src
    ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />
    : <span className="celeb-stories-image-fallback" aria-hidden="true">{name.slice(0, 1)}</span>
}
