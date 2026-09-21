import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeenSliderInstance } from 'keen-slider'
import { keenSliderRecovery, refreshKeenSlider } from './keenSliderRecovery'

function harness() {
  const doc = Object.assign(new EventTarget(), { hidden: false })
  const win = new EventTarget()
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', win)
  let nextId = 0
  const frames = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const runFrame = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach((callback) => callback(0)) }
  const settle = () => { runFrame(); runFrame(); runFrame() }
  const makeSlide = () => {
    const styles = new Map([['transform', 'translate3d(-354px, 0, 0)'], ['min-width', '354px']])
    return { style: { getPropertyValue: (key: string) => styles.get(key) ?? '', setProperty: (key: string, value: string) => styles.set(key, value) } }
  }
  let children = [makeSlide(), makeSlide(), makeSlide()]
  const rect = { width: 354, height: 530 }
  const container = Object.assign(new EventTarget(), {
    isConnected: true, scrollLeft: 18, scrollTop: 0, dataset: {} as Record<string, string>,
    getBoundingClientRect: () => rect, querySelectorAll: () => children,
  })
  const observers: { resize?: () => void; mutation?: () => void } = {}
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { observers.resize = callback } observe() {} disconnect = disconnect })
  vi.stubGlobal('MutationObserver', class { constructor(callback: () => void) { observers.mutation = callback } observe() {} disconnect = disconnect })
  const events = new Map<string, (() => void)[]>()
  const emit = (name: string) => events.get(name)?.forEach((fn) => fn())
  const instance = {
    container, slides: [...children], options: { loop: true, slides: { perView: 1 } },
    track: { details: { rel: 1 } }, animator: { active: false, stop: vi.fn() },
    on: (name: string, callback: () => void) => events.set(name, [...(events.get(name) ?? []), callback]),
    update: vi.fn((options: unknown, index: number) => {
      if (options) children.forEach((slide) => slide.style.setProperty('transform', ''))
      instance.slides = [...children]
      instance.track.details.rel = index
    }),
  }
  const slider = instance as unknown as KeenSliderInstance
  return { slider, instance, container, rect, doc, win, emit, observers, settle, frames, disconnect, reorder: () => { children = [children[1], children[2], children[0]] } }
}

afterEach(() => vi.unstubAllGlobals())

describe('Keen slider recovery', () => {
  it('remeasures unchanged nodes without clearing styles or restarting the renderer', () => {
    const h = harness()
    expect(refreshKeenSlider(h.slider)).toBe(true)
    expect(h.instance.update).toHaveBeenCalledWith(undefined, 1)
    expect(h.container.scrollLeft).toBe(0)
    expect(h.instance.slides[0].style.getPropertyValue('transform')).toContain('translate3d')
  })
  it('rebinds same-count reordered nodes while preserving the current painted frame', () => {
    const h = harness()
    h.reorder()
    refreshKeenSlider(h.slider, 0)
    expect(h.instance.update).toHaveBeenCalledWith(h.instance.options, 0)
    expect(h.instance.slides[0].style.getPropertyValue('transform')).toContain('translate3d')
  })
  it('waits for a measurable visible container', () => {
    const h = harness()
    h.rect.width = 0
    expect(refreshKeenSlider(h.slider)).toBe(false)
    h.rect.width = 354
    h.doc.hidden = true
    expect(refreshKeenSlider(h.slider)).toBe(false)
    expect(h.instance.update).not.toHaveBeenCalled()
  })
  it('keeps the same product after a DOM reorder and cleans up all recovery work', () => {
    const h = harness()
    keenSliderRecovery(h.slider)
    h.emit('created')
    h.settle()
    h.instance.update.mockClear()
    h.reorder()
    h.observers.mutation?.()
    h.settle()
    expect(h.instance.update).toHaveBeenCalledWith(h.instance.options, 0)
    expect(h.container.dataset.sliderReady).toBe('true')
    h.emit('destroyed')
    h.win.dispatchEvent(new Event('pageshow'))
    h.settle()
    expect(h.instance.update).toHaveBeenCalledTimes(1)
    expect(h.disconnect).toHaveBeenCalledTimes(2)
    expect(h.frames.size).toBe(0)
  })
  it('recovers page restoration but does not interrupt a running swipe or autoplay transition', () => {
    const h = harness()
    keenSliderRecovery(h.slider)
    h.emit('created')
    h.settle()
    h.instance.update.mockClear()
    h.instance.animator.active = true
    h.observers.mutation?.()
    h.settle()
    expect(h.instance.update).not.toHaveBeenCalled()
    h.instance.animator.active = false
    h.emit('animationEnded')
    h.settle()
    expect(h.instance.update).toHaveBeenCalledTimes(1)
    h.instance.update.mockClear()
    h.container.scrollLeft = 18
    h.win.dispatchEvent(new Event('pageshow'))
    h.settle()
    expect(h.container.scrollLeft).toBe(0)
    expect(h.instance.update).toHaveBeenCalledWith(undefined, 1)
  })
})
