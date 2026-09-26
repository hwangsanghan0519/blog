import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageFileToOptimizedDataUrl } from './file'

describe('mobile image compression', () => {
  const context = { drawImage: vi.fn(), getImageData: vi.fn() }
  const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: vi.fn() }
  let image: { width: number; height: number; onload: () => void; onerror: () => void }

  beforeEach(() => {
    vi.clearAllMocks()
    context.getImageData.mockReturnValue({ data: new Uint8ClampedArray([120, 80, 20, 255]) })
    canvas.toDataURL.mockReset().mockReturnValue('data:image/webp;base64,compressed')
    image = { width: 4032, height: 3024, onload: () => {}, onerror: () => {} }
    vi.stubGlobal('Image', class { constructor() { return image } })
    vi.stubGlobal('document', { createElement: () => canvas })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  function load() {
    const result = imageFileToOptimizedDataUrl(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))
    image.onload()
    return result
  }

  it('compresses opaque photos as JPEG when WebP silently returns PNG', async () => {
    canvas.toDataURL.mockImplementation((format) => format === 'image/jpeg'
      ? 'data:image/jpeg;base64,compressed'
      : `data:image/png;base64,${'A'.repeat(2_000_000)}`)
    const result = await load()
    expect(result).toBe('data:image/jpeg;base64,compressed')
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8)
  })

  it('preserves transparency when WebP encoding is unavailable', async () => {
    context.getImageData.mockReturnValue({ data: new Uint8ClampedArray([0, 0, 0, 0]) })
    canvas.toDataURL.mockReturnValue('data:image/png;base64,transparent')
    expect(await load()).toBe('data:image/png;base64,transparent')
    expect(canvas.toDataURL).not.toHaveBeenCalledWith('image/jpeg', expect.anything())
  })

  it('bounds each encoded image so five product photos stay below 4 MB', async () => {
    canvas.toDataURL.mockImplementation(() => `data:image/webp;base64,${'A'.repeat(canvas.width * canvas.height)}`)
    const result = await load()
    expect(result.length).toBeLessThanOrEqual(750_000)
    expect(JSON.stringify({ coverImage: result, detailImages: Array(4).fill(result) }).length).toBeLessThan(4_000_000)
    expect(context.drawImage.mock.calls.length).toBeGreaterThan(1)
    expect(canvas.width).toBe(0)
    expect(canvas.height).toBe(0)
  })

  it('limits the long side of portrait photos to avoid oversized canvases', async () => {
    const result = imageFileToOptimizedDataUrl(new File(['photo'], 'portrait.jpg'))
    image.width = 3024
    image.height = 4032
    image.onload()
    await result
    expect(context.drawImage).toHaveBeenCalledWith(image, 0, 0, 1200, 1600)
  })

  it('rejects an empty canvas encoding instead of saving a broken image', async () => {
    canvas.toDataURL.mockReturnValue('data:,')
    await expect(load()).rejects.toThrow('Image encoding failed')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
})
