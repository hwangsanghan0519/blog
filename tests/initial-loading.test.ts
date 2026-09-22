import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInitialLoading } from '../src/pages/commerce-studio/lib/useInitialLoading'

const effects = vi.hoisted(() => ({ cleanup: undefined as undefined | (() => void) }))
vi.mock('react', () => ({ useEffect: (effect: () => void | (() => void)) => { effects.cleanup = effect() || undefined } }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setTimeout, clearTimeout }))
  vi.stubGlobal('document', { documentElement: { dataset: { bootState: 'loading' } } })
  // Reproduce an embedded app that never delivers a requested animation frame.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => { effects.cleanup?.(); effects.cleanup = undefined; vi.unstubAllGlobals(); vi.useRealTimers() })

describe('initial loading in suspended app renderers', () => {
  it('releases ready data even if the WebView never runs animation frames', () => {
    const ready = vi.fn()
    window.addEventListener('storefront-ready', ready)
    useInitialLoading(true)
    vi.advanceTimersByTime(2199)
    expect(ready).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ready).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(ready).toHaveBeenCalledTimes(1)
  })

  it('does not release unavailable data or an effect that was cleaned up', () => {
    const ready = vi.fn()
    window.addEventListener('storefront-ready', ready)
    useInitialLoading(false)
    vi.advanceTimersByTime(3000)
    expect(ready).not.toHaveBeenCalled()
    useInitialLoading(true)
    effects.cleanup?.()
    vi.advanceTimersByTime(3000)
    expect(ready).not.toHaveBeenCalled()
  })
})
