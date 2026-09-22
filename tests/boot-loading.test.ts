import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const bootScript = html.match(/<script>([\s\S]*?)<\/script>/)![1]

function boot() {
  const animation = { cancel: vi.fn(), play: vi.fn() }
  const loader = { setAttribute: vi.fn(), getAnimations: () => [animation] }
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    documentElement: { dataset: { bootState: '' } },
    getElementById: () => loader,
  })
  const window = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout,
    requestAnimationFrame: (callback: () => void) => setTimeout(callback, 16),
  })
  runInNewContext(bootScript, { window, document, performance: { now: () => Date.now() } })
  return { document, window, loader, animation, state: () => document.documentElement.dataset.bootState }
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

  it('adds no extra delay once a slow load is ready', () => {
    const h = boot()
    h.document.dispatchEvent(new Event('DOMContentLoaded'))
    vi.advanceTimersByTime(3000)
    expect(h.state()).toBe('loading')
    h.window.dispatchEvent(new Event('storefront-ready'))
    vi.advanceTimersByTime(1)
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
})
