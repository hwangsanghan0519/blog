import { useEffect } from 'react'

/** Release the HTML loader only after data, first-screen assets and layout settle. */
export function useInitialLoading(dataReady: boolean) {
  useEffect(() => {
    if (document.documentElement.dataset.bootState !== 'loading') return
    const reportProgress = (progress: number) => window.dispatchEvent(new CustomEvent('storefront-progress', { detail: progress }))
    reportProgress(dataReady ? 65 : 30)
    if (!dataReady) return

    let cancelled = false
    let released = false
    let frame = 0
    let timeout = 0
    const finish = () => {
      if (cancelled || released) return
      released = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      window.clearTimeout(frameDeadline)
      window.dispatchEvent(new Event('storefront-ready'))
    }
    // Some embedded app browsers suspend rAF. Data is ready, so don't wait for it forever.
    const frameDeadline = window.setTimeout(finish, 2200)

    frame = requestAnimationFrame(() => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('#root img'))
        .filter((image) => {
          const rect = image.getBoundingClientRect()
          return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
            && rect.top < window.innerHeight && rect.left < window.innerWidth
        })
      const pendingAssets = [
        document.fonts?.ready ?? Promise.resolve(),
        ...images.map((image) => Promise.resolve().then(() => image.decode?.())),
      ]
      let settledAssets = 0
      const settleAsset = () => {
        settledAssets += 1
        if (!cancelled && !released) reportProgress(65 + Math.round(30 * settledAssets / pendingAssets.length))
      }
      const assets = Promise.allSettled(pendingAssets.map((asset) => asset.then(settleAsset, settleAsset)))
      // A slow image/font must not block entry indefinitely. Data has its own timeout.
      const deadline = new Promise<void>((resolve) => { timeout = window.setTimeout(resolve, 1800) })

      void Promise.race([assets, deadline]).then(() => {
        if (cancelled || released) return
        window.clearTimeout(timeout)
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(finish)
        })
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      window.clearTimeout(frameDeadline)
    }
  }, [dataReady])
}
