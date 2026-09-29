import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './ranking-confetti.css'

const PARTICLES = Array.from({ length: 24 }, (_, index) => ({
  '--confetti-left': `${4 + (index * 29) % 92}%`,
  '--confetti-drift': `${(index * 17) % 65 - 32}px`,
  '--confetti-turn': `${(index % 2 ? -1 : 1) * (240 + (index * 37) % 360)}deg`,
  '--confetti-delay': `${150 + (index * 43) % 280}ms`,
  '--confetti-duration': `${1600 + (index * 61) % 500}ms`,
}) as CSSProperties)

/** One lightweight burst when the podium enters its scroll viewport. */
export function RankingConfetti() {
  const host = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'done'>('waiting')

  useEffect(() => {
    const element = host.current
    if (!element) return
    let started = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let observer: IntersectionObserver | undefined
    const finish = () => {
      clearTimeout(timer)
      observer?.disconnect()
      setPhase('done')
    }
    const start = () => {
      if (started || document.visibilityState === 'hidden') return
      started = true
      observer?.disconnect()
      setPhase('playing')
      // Also clean up if Safari suspends CSS animation events in the background.
      timer = setTimeout(finish, 2800)
    }
    const onVisibilityChange = () => {
      if (started && document.visibilityState === 'hidden') finish()
      else if (!started && document.visibilityState === 'visible') {
        // Re-check an initially backgrounded mobile tab without replaying a completed burst.
        if (observer) { observer.unobserve(element); observer.observe(element) }
        else start()
      }
    }
    if (typeof IntersectionObserver === 'undefined') start()
    else {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) start()
      }, { threshold: 0.1 })
      observer.observe(element)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearTimeout(timer)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  if (phase === 'done') return null
  return <div ref={host} className="ranking-confetti" aria-hidden="true">
    {phase === 'playing' && PARTICLES.map((style, index) => <i key={index} style={style} />)}
  </div>
}
