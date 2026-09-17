import { useEffect, useMemo, useRef } from 'react'
import { normalizeEditorContent } from '../../entities/post/lib/content'

type RenderedContentProps = {
  content: string
}

export function RenderedContent({ content }: RenderedContentProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const html = useMemo(() => normalizeEditorContent(content), [content])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const blocks = Array.from(root.querySelectorAll('pre'))

    blocks.forEach((block) => {
      const code = block.querySelector('code')
      if (!code || block.dataset.copyReady === 'true') return

      const language = readLanguage(block, code)
      block.classList.add('rendered-code-block')
      block.dataset.copyReady = 'true'
      block.dataset.language = language

      const button = document.createElement('button')
      button.className = 'code-copy-button'
      button.type = 'button'
      button.textContent = '복사'
      button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(code.textContent ?? '')
        button.textContent = '복사됨'
        window.setTimeout(() => {
          button.textContent = '복사'
        }, 1200)
      })

      block.appendChild(button)
    })
  }, [html])

  return <div ref={rootRef} className="rendered-content" dangerouslySetInnerHTML={{ __html: html }} />
}

function readLanguage(block: HTMLElement, code: Element) {
  if (block.dataset.language) return block.dataset.language

  const languageClass = Array.from(code.classList).find((className) => className.startsWith('language-'))
  return languageClass?.replace('language-', '').toUpperCase() || 'CODE'
}
