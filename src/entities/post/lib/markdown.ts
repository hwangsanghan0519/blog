function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

// 개인용 미리보기라 필요한 Markdown 일부만 직접 변환합니다.
// 외부 HTML 주입을 피하려고 텍스트는 먼저 escapeHtml로 안전하게 이스케이프합니다.
export function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false
  let codeLanguage = ''
  let codeLines: string[] = []

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      if (codeLanguage) {
        html.push(`<pre><code class="language-${escapeHtml(codeLanguage)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`)
        codeLanguage = ''
        codeLines = []
        return
      }

      codeLanguage = line.replace(/^```/, '').trim() || 'javascript'
      return
    }

    if (codeLanguage) {
      codeLines.push(line)
      return
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`)
      return
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }

    if (line.startsWith('# ')) html.push(`<h1>${renderInline(line.slice(2))}</h1>`)
    else if (line.startsWith('## ')) html.push(`<h2>${renderInline(line.slice(3))}</h2>`)
    else if (line.startsWith('### ')) html.push(`<h3>${renderInline(line.slice(4))}</h3>`)
    else if (line.startsWith('> ')) html.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`)
    else if (/^!\[(.*)]\((.*)\)$/.test(line.trim())) {
      const [, alt, src] = line.trim().match(/^!\[(.*)]\((.*)\)$/) ?? []
      html.push(`<img src="${src}" alt="${escapeHtml(alt ?? '')}" />`)
    } else if (line.trim()) html.push(`<p>${renderInline(line)}</p>`)
  })

  if (inList) html.push('</ul>')
  if (codeLanguage) {
    html.push(`<pre><code class="language-${escapeHtml(codeLanguage)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`)
  }

  return html.join('')
}
