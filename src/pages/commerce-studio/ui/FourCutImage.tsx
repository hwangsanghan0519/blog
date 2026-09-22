import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { RotateCcw } from 'lucide-react'
import './four-cut-loading.css'

export function FourCutLoading({ index }: { index?: number }) {
  return (
    <div className="four-cut-loading" role="status">
      <div className="four-cut-camera-scene" aria-hidden="true">
        <div className="four-cut-viewfinder" />
        <div className="four-cut-camera">
          <i className="four-cut-camera-lens" />
          <i className="four-cut-camera-flash" />
        </div>
        <div className="four-cut-film">
          {[0, 1, 2, 3].map((cut) => <i key={cut} style={{ animationDelay: `${cut * 0.65}s` }} />)}
        </div>
      </div>
      <strong>찰칵! {index === undefined ? '셀럽네컷' : `${index + 1}번째 컷`} 준비 중</strong>
      <small>사진을 불러오고 있어요</small>
    </div>
  )
}

/** Key this component by the full image URL so replacement photos start fresh. */
export function FourCutImage({ src, alt, index, onOpen }: {
  src: string
  alt: string
  index: number
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const image = imageRef.current
    if (!image) return
    let cancelled = false
    const fail = () => { if (!cancelled) setState('error') }
    const reveal = async () => {
      // Cached images can finish before the effect subscribes to load.
      try { await image.decode() } catch { /* A loaded image may still be displayable. */ }
      if (!cancelled) setState(image.naturalWidth > 0 ? 'ready' : 'error')
    }
    image.addEventListener('load', reveal)
    image.addEventListener('error', fail)
    if (image.complete) {
      if (image.naturalWidth > 0) void reveal()
      else fail()
    }
    return () => {
      cancelled = true
      image.removeEventListener('load', reveal)
      image.removeEventListener('error', fail)
    }
  }, [src, attempt])

  return (
    <figure className="four-cut-photo" data-image-state={state}>
      <Dialog.Trigger asChild>
        <button className="four-cut-image-trigger" type="button" disabled={state !== 'ready'} aria-label={`${index + 1}번 셀럽네컷 원본 이미지 보기`} onClick={onOpen}>
          <img key={attempt} ref={imageRef} src={src} alt={alt} decoding="async" loading="lazy" />
          <span>{String(index + 1).padStart(2, '0')}</span>
        </button>
      </Dialog.Trigger>
      {state === 'loading' && <FourCutLoading index={index} />}
      {state === 'error' && (
        <div className="four-cut-photo-error" role="status">
          <p>사진을 불러오지 못했어요</p>
          <button type="button" onClick={() => { setState('loading'); setAttempt((value) => value + 1) }}>
            <RotateCcw size={16} aria-hidden="true" /> 다시 불러오기
          </button>
        </div>
      )}
    </figure>
  )
}
