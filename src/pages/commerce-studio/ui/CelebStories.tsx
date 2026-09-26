import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { InstagramSourceIcon } from '../../../entities/post/ui/ProductSourceIcons'
import { fetchCelebStories } from '../api/celebStoryApi'
import { DEFAULT_CELEB_ACCOUNTS, formatFollowers } from '../model/celebAccounts'
import { retainProfile } from '../model/celebProfileCache'
import type { CelebAccount, CelebStoryFeed } from '../model/celebStoryTypes'
import './celeb-stories.css'

type Props = { categoryImages: Record<string, string>; accounts?: CelebAccount[] }

export function CelebStories({ categoryImages, accounts = DEFAULT_CELEB_ACCOUNTS }: Props) {
  const [profiles, setProfiles] = useState<Record<string, CelebStoryFeed>>({})
  const [busy, setBusy] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const [hasEntered, setHasEntered] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)
  const hasAccounts = accounts.length > 0

  useEffect(() => {
    const section = sectionRef.current
    if (!section || hasEntered || !('IntersectionObserver' in window)
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < .35) return
      setHasEntered(true)
      observer.disconnect()
    }, { threshold: .35, rootMargin: '0px 0px -6% 0px' })
    observer.observe(section)
    return () => observer.disconnect()
  }, [hasAccounts, hasEntered])

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
            } catch { /* Preserve recent successful data during a transient failure. */ }
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
    <section ref={sectionRef} className={`celeb-stories${hasEntered ? ' is-entered' : ''}`} aria-labelledby="instagram-live-title" style={{ '--celeb-columns': Math.min(accounts.length, 8) } as CSSProperties}>
      <header className="celeb-stories-heading">
        <InstagramSourceIcon size={18} />
        <h2 id="instagram-live-title">인스타라이브</h2>
      </header>
      <div className="celeb-stories-nav-wrap">
        <div className="celeb-stories-nav" ref={navRef} aria-busy={busy} aria-label="셀럽 Instagram 프로필">
          {accounts.map((account, index) => {
            const profile = profiles[account.username]
            const readable = profile?.state === 'ready' || profile?.state === 'stale'
            const count = readable ? profile.followers : null
            const followers = formatFollowers(count)
            const unit = followers.match(/[만억]$/)?.[0] ?? ''
            return <a key={account.username} className="celeb-stories-person"
              style={{ '--celeb-enter-delay': `${Math.min(index, 7) * 65}ms` } as CSSProperties}
              href={`https://www.instagram.com/${account.username}/`} target="_blank" rel="noopener noreferrer"
              aria-label={`${account.name}, 팔로워 ${count != null ? formatFollowers(count) : '확인 불가'}, 인스타그램 바로가기 (새 창)`}>
              {/* Decorative on every profile; never represents verified active stories. */}
              <span className="celeb-stories-avatar"><span>
                <ProfileImage src={profile?.profileImage || categoryImages[account.name]} name={account.name} />
              </span></span>
              <strong className="celeb-stories-name">{account.name}</strong>
              <span className="celeb-stories-followers" title={count != null ? `팔로워 ${count.toLocaleString('ko-KR')}명${profile?.state === 'stale' ? ' · 최근 확인한 수치' : ''}` : '현재 팔로워 수를 확인할 수 없어요'}>
                <span className="celeb-stories-followers-number">{unit ? followers.slice(0, -1) : followers}</span>
                {unit && <small className="celeb-stories-followers-unit">{unit}</small>}
                {profile?.state === 'stale' && <i aria-label="최근 확인한 수치" />}
              </span>
            </a>
          })}
        </div>
        {canScroll && <div className="celeb-stories-nav-controls">
          <button type="button" aria-label="이전 셀럽 보기" onClick={() => navRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}><ChevronLeft size={16} /></button>
          <button type="button" aria-label="다음 셀럽 보기" onClick={() => navRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}><ChevronRight size={16} /></button>
        </div>}
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
