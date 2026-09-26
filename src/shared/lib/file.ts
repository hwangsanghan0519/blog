// 대표 사진과 네컷을 한 요청에 담아도 전송량이 과도해지지 않도록 제한합니다.
const MAX_IMAGE_DATA_URL_LENGTH = 750_000

export function imageFileToOptimizedDataUrl(file: File, maxWidth = 1600, quality = 0.8) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(1, maxWidth / Math.max(image.width, image.height))
      let targetWidth = Math.max(1, Math.round(image.width * scale))
      let targetHeight = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Canvas context is not available.'))
        return
      }

      try {
        let format = 'image/webp'
        while (true) {
          canvas.width = targetWidth
          canvas.height = targetHeight
          context.drawImage(image, 0, 0, targetWidth, targetHeight)
          let result = canvas.toDataURL(format, quality)

          // WebP 인코딩을 지원하지 않으면 PNG가 반환됩니다. 사진은 JPEG로
          // 압축하되 투명 스티커는 PNG를 유지해 배경이 검게 변하지 않게 합니다.
          if (format === 'image/webp' && result.startsWith('data:image/png')) {
            const pixels = context.getImageData(0, 0, targetWidth, targetHeight).data
            let transparent = false
            for (let index = 3; index < pixels.length; index += 4) {
              if (pixels[index] < 255) { transparent = true; break }
            }
            format = transparent ? 'image/png' : 'image/jpeg'
            result = canvas.toDataURL(format, quality)
          }

          if (!result.startsWith('data:image/')) throw new Error('Image encoding failed.')
          if (result.length <= MAX_IMAGE_DATA_URL_LENGTH) {
            resolve(result)
            return
          }
          if (targetWidth === 1 && targetHeight === 1) throw new Error('Image is too large.')
          targetWidth = Math.max(1, Math.floor(targetWidth * 0.8))
          targetHeight = Math.max(1, Math.floor(targetHeight * 0.8))
        }
      } catch (error) {
        reject(error)
      } finally {
        canvas.width = 0
        canvas.height = 0
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image could not be loaded.'))
    }

    image.src = objectUrl
  })
}

export function downloadJson(filename: string, data: unknown) {
  const payload = JSON.stringify(data, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
