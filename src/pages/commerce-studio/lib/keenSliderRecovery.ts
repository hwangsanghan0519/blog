import type { KeenSliderInstance, KeenSliderPlugin } from 'keen-slider'

/** Re-measure in place; rebind the renderer only when React replaced/reordered its nodes. */
export function refreshKeenSlider(slider: KeenSliderInstance, index = slider.track.details?.rel ?? 0) {
  const container = slider.container
  const { width, height } = container.getBoundingClientRect()
  if (!container.isConnected || document.hidden || width <= 1 || height <= 1) return false

  const slides = Array.from(container.querySelectorAll<HTMLElement>('.keen-slider__slide'))
  if (!slides.length) return false
  const target = Math.min(Math.max(0, index), slides.length - 1)
  const nodesChanged = slides.length !== slider.slides.length || slides.some((slide, index) => slide !== slider.slides[index])
  slider.animator.stop()
  // Focus/scroll restoration can scroll overflow:hidden independently of Keen's transforms.
  container.scrollLeft = 0
  container.scrollTop = 0
  if (nodesChanged) {
    // Keen clears inline styles on optionsChanged and repaints on the next frame.
    // Keep the current frame intact until that renderer has written the new geometry.
    const properties = ['transform', '-webkit-transform', 'min-width', 'max-width', 'min-height', 'max-height']
    const previousStyles = slides.map((slide) => properties.map((property) => slide.style.getPropertyValue(property)))
    slider.update({ ...slider.options }, target)
    slides.forEach((slide, index) => properties.forEach((property, propertyIndex) => {
      const value = previousStyles[index][propertyIndex]
      if (value) slide.style.setProperty(property, value)
    }))
  } else {
    slider.update(undefined, target)
  }
  return true
}

export const keenSliderRecovery: KeenSliderPlugin = (slider) => {
  let disposed = false
  let dragging = false
  let pending = false
  let frame = 0
  let settleFrame = 0
  let readyFrame = 0
  let activeElement: HTMLElement | undefined
  let activeIndex = 0
  let measuredWidth = 0
  let measuredHeight = 0
  const container = slider.container

  const rememberSlide = () => {
    activeIndex = slider.track.details?.rel ?? 0
    activeElement = slider.slides[activeIndex]
  }

  const refresh = () => {
    settleFrame = 0
    if (disposed || dragging || slider.animator.active || document.hidden) return
    const children = Array.from(container.querySelectorAll<HTMLElement>('.keen-slider__slide'))
    const preservedIndex = activeElement ? children.indexOf(activeElement) : -1
    if (!refreshKeenSlider(slider, preservedIndex >= 0 ? preservedIndex : activeIndex)) return
    pending = false
    rememberSlide()
    const rect = container.getBoundingClientRect()
    measuredWidth = rect.width
    measuredHeight = rect.height
    // Keen writes its measured transforms in its own animation frame.
    readyFrame = requestAnimationFrame(() => {
      readyFrame = 0
      if (!disposed && !pending && !document.hidden) container.dataset.sliderReady = 'true'
    })
  }

  const schedule = () => {
    if (disposed) return
    pending = true
    container.dataset.sliderReady = 'false'
    cancelAnimationFrame(readyFrame)
    readyFrame = 0
    if (frame || settleFrame || dragging || document.hidden) return
    frame = requestAnimationFrame(() => {
      frame = 0
      settleFrame = requestAnimationFrame(refresh)
    })
  }

  const suspend = () => {
    dragging = false
    slider.animator.stop()
    container.dataset.sliderReady = 'false'
  }

  const restore = () => {
    suspend()
    schedule()
  }
  const visibilityChanged = () => document.hidden ? suspend() : restore()
  const nativeScroll = () => {
    if (container.scrollLeft || container.scrollTop) schedule()
  }
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    const rect = container.getBoundingClientRect()
    if (Math.abs(rect.width - measuredWidth) < 0.5 && Math.abs(rect.height - measuredHeight) < 0.5) return
    measuredWidth = rect.width
    measuredHeight = rect.height
    schedule()
  })
  const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(schedule)

  slider.on('created', () => {
    rememberSlide()
    resizeObserver?.observe(container)
    // React may replace/reorder keyed slides without changing the slide count.
    mutationObserver?.observe(container, { childList: true })
    window.addEventListener('pageshow', restore)
    window.addEventListener('pagehide', suspend)
    window.addEventListener('popstate', restore)
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('orientationchange', restore)
    document.addEventListener('visibilitychange', visibilityChanged)
    container.addEventListener('scroll', nativeScroll, { passive: true })
    void document.fonts?.ready.then(schedule)
    schedule()
  })
  slider.on('slideChanged', rememberSlide)
  slider.on('dragStarted', () => { dragging = true })
  slider.on('dragEnded', () => {
    dragging = false
    if (pending) schedule()
  })
  slider.on('animationEnded', () => { if (pending) schedule() })
  slider.on('destroyed', () => {
    disposed = true
    cancelAnimationFrame(frame)
    cancelAnimationFrame(settleFrame)
    cancelAnimationFrame(readyFrame)
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    window.removeEventListener('pageshow', restore)
    window.removeEventListener('pagehide', suspend)
    window.removeEventListener('popstate', restore)
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', restore)
    document.removeEventListener('visibilitychange', visibilityChanged)
    container.removeEventListener('scroll', nativeScroll)
    delete container.dataset.sliderReady
  })
}
