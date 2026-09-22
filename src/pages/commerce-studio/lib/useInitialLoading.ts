import { useEffect } from 'react'

/** Release the HTML loader only after data, first-screen assets and layout settle. */
export function useInitialLoading(dataReady: boolean) {
  useEffect(() => {
    if (!dataReady || document.documentElement.dataset.bootState !== 'loading') return

    let cancelled = false
    let frame = 0
    let timeout = 0

    frame = requestAnimationFrame(() => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('#root img'))
        .filter((image) => {
          const rect = image.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
            && rect.top < window.innerHeight && rect.left < window.innerWidth
        })
      const assets = Promise.allSettled([
        document.fonts.ready,
        ...images.map((image) => image.decode()),
      ])
      // A slow image/font must not block entry indefinitely. Data has its own timeout.
      const deadline = new Promise<void>((resolve) => { timeout = window.setTimeout(resolve, 1800) })

      void Promise.race([assets, deadline]).then(() => {
        if (cancelled) return
        window.clearTimeout(timeout)
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            window.dispatchEvent(new Event('storefront-ready'))
          })
        })
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [dataReady])
}
