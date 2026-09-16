import { renderMarkdown } from './markdown'

export function normalizeEditorContent(content: string) {
  const trimmed = content.trim()

  if (!trimmed) return '<p></p>'
  if (looksLikeHtml(trimmed)) return trimmed

  // 이전 textarea 버전에서 저장된 Markdown 글도 새 Tiptap 에디터에서 그대로 열리도록 변환합니다.
  return renderMarkdown(trimmed)
}

function looksLikeHtml(content: string) {
  return /<\/?[a-z][\s\S]*>/i.test(content)
}
