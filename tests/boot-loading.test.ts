import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const bootScript = html.match(/<script>([\s\S]*?)<\/script>/)![1]

function boot({ reducedMotion = false, suspendFrames = false } = {}) {
  const animation = { cancel: vi.fn(), play: vi.fn() }
  const loader = { setAttribute: vi.fn(), getAnimations: () => [animation] }
  const bar = { style: { width: '8%' } }
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: { dataset: { bootState: '' } },
    getElementById: (id: string) => id === 'app-boot-progress' ? bar : loader,
  })
  const window = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout, setInterval, clearInterval,
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: (callback: () => void) => suspendFrames ? 0 : setTimeout(callback, 16),
  })
  runInNewContext(bootScript, { window, document, performance: { now: () => Date.now() } })
  return { document, window, loader, bar, animation, state: () => document.documentElement.dataset.bootState }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('app reload boot loader', () => {
  it('keeps a cached reload visible for an animation cycle after the first frame', () => {
    const h = boot()
    h.window.dispatchEvent(new Event('storefront-ready'))
    vi.advanceTimersByTime(2000)
    expect(h.state()).toBe('loading')
    h.document.dispatchEvent(new Event('DOMContentLoaded'))
    vi.advanceTimersByTime(16 + 849)
    expect(h.state()).toBe('loading')
    vi.advanceTimersByTime(1)
    expect(h.state()).toBe('ready')
    expect(h.loader.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
  })

  it('paints a full gauge briefly before releasing a slow load', () => {
    const h = boot()
    h.document.dispatchEvent(new Event('DOMContentLoaded'))
    vi.advanceTimersByTime(3000)
    expect(h.state()).toBe('loading')
    h.window.dispatchEvent(new Event('storefront-ready'))
    vi.advanceTimersByTime(280)
    expect(parseFloat(h.bar.style.width)).toBe(100)
    expect(h.state()).toBe('loading')
    vi.advanceTimersByTime(20)
    expect(h.state()).toBe('ready')
  })

  it('releases the screen at the deadline even if the app never becomes ready', () => {
    const h = boot()
    vi.advanceTimersByTime(15000)
    expect(h.state()).toBe('ready')
  })

  it('restarts suspended animations only while the loader is visible', () => {
    const h = boot()
    h.document.hidden = true
    h.document.dispatchEvent(new Event('visibilitychange'))
    expect(h.animation.play).not.toHaveBeenCalled()
    h.document.hidden = false
    h.document.dispatchEvent(new Event('visibilitychange'))
    expect(h.animation.cancel).toHaveBeenCalledTimes(1)
    expect(h.animation.play).toHaveBeenCalledTimes(1)
    h.window.dispatchEvent(new Event('pageshow'))
    expect(h.animation.play).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(15000)
    h.window.dispatchEvent(new Event('pageshow'))
    expect(h.animation.play).toHaveBeenCalledTimes(2)
  })

  it('fills the actual bar through readiness stages without CSS animations or animation frames', () => {
    const h = boot({ suspendFrames: true })
    h.document.dispatchEvent(new Event('DOMContentLoaded'))
    vi.advanceTimersByTime(120)
    h.window.dispatchEvent(new CustomEvent('storefront-progress', { detail: 30 }))
    vi.advanceTimersByTime(120)
    expect(parseFloat(h.bar.style.width)).toBeGreaterThan(8)
    expect(parseFloat(h.bar.style.width)).toBeLessThan(30)
    vi.advanceTimersByTime(160)
    expect(parseFloat(h.bar.style.width)).toBe(30)
    h.window.dispatchEvent(new CustomEvent('storefront-progress', { detail: 65 }))
    vi.advanceTimersByTime(280)
    expect(parseFloat(h.bar.style.width)).toBe(65)
    // StrictMode effects and late asset callbacks must never move progress backwards.
    h.window.dispatchEvent(new CustomEvent('storefront-progress', { detail: 30 }))
    vi.advanceTimersByTime(80)
    expect(parseFloat(h.bar.style.width)).toBe(65)
    h.window.dispatchEvent(new Event('storefront-ready'))
    vi.advanceTimersByTime(1000)
    expect(h.bar.style.width).toBe('100%')
    expect(h.state()).toBe('ready')
  })

  it('updates instantly with reduced motion and restores progress after app backgrounding', () => {
    const h = boot({ reducedMotion: true })
    h.document.dispatchEvent(new Event('DOMContentLoaded'))
    vi.advanceTimersByTime(16)
    h.window.dispatchEvent(new CustomEvent('storefront-progress', { detail: 65 }))
    expect(parseFloat(h.bar.style.width)).toBe(65)
    h.bar.style.width = '0%'
    h.window.dispatchEvent(new Event('pageshow'))
    expect(parseFloat(h.bar.style.width)).toBe(65)
    h.window.dispatchEvent(new CustomEvent('storefront-progress', { detail: NaN }))
    expect(parseFloat(h.bar.style.width)).toBe(65)
    h.window.dispatchEvent(new Event('storefront-ready'))
    expect(parseFloat(h.bar.style.width)).toBe(100)
  })
})
