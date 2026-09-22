import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getProductTags } from '../../../shared/lib/product-seo'

export function ProductTagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const composing = useRef(false)

  const add = (value: string) => {
    const values = value.split(/[,\n]+/).map((tag) => tag.trim()).filter(Boolean)
    if (values.some((tag) => tag.replace(/^#+\s*/, '').normalize('NFKC').length > 48)) {
      setError('태그 하나는 48자 이내로 입력해 주세요.')
      return false
    }
    if (values.length) onChange(getProductTags([...tags, ...values], Infinity))
    setError('')
    return true
  }
  const commit = () => { if (add(draft)) setDraft('') }
  const edit = (value: string) => {
    setDraft(value)
    setError('')
    if (!composing.current && value.includes(',')) {
      const splitAt = value.lastIndexOf(',')
      if (add(value.slice(0, splitAt))) setDraft(value.slice(splitAt + 1))
    }
  }

  return (
    <div className="product-tag-editor">
      <label htmlFor="product-tag-input">상품 태그 <small>{tags.length}개</small></label>
      {tags.length > 0 && <ul className="product-tag-editor-list" aria-label="등록한 상품 태그">
        {tags.map((tag, index) => <li key={`${index}-${tag}`}><span>#{tag.replace(/^#+/, '')}</span><button type="button" aria-label={`${tag} 태그 삭제`} onClick={() => onChange(tags.filter((_, tagIndex) => tagIndex !== index))}><X size={13} aria-hidden="true" /></button></li>)}
      </ul>}
      <div className="product-tag-editor-input">
        <input id="product-tag-input" value={draft} placeholder="브랜드, 모델명, 상품 종류" aria-describedby="product-tags-help product-tags-error" aria-invalid={Boolean(error)}
          onChange={(event) => edit(event.target.value)}
          onCompositionStart={() => { composing.current = true }}
          onCompositionEnd={(event) => { composing.current = false; edit(event.currentTarget.value) }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing.current || event.nativeEvent.keyCode === 229) return
            if (event.key === 'Enter') { event.preventDefault(); commit() }
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text')
            if (!/[,\n]/.test(pasted)) return
            event.preventDefault()
            const value = [draft, pasted].filter(Boolean).join(',')
            if (add(value)) setDraft('')
            else setDraft(value)
          }}
          onBlur={() => { if (!composing.current) commit() }}
        />
        <button type="button" onClick={commit} disabled={!draft.trim()}>추가</button>
      </div>
      <small id="product-tags-help">Enter나 쉼표로 여러 태그를 추가하세요. 쉼표·줄바꿈으로 구분한 태그를 한 번에 붙여넣을 수도 있어요. 브랜드·모델명 등 관련 단어를 앞에 두면 첫 12개가 상품상세와 검색 정보에 반영됩니다.</small>
      <p id="product-tags-error" role="status">{error}</p>
    </div>
  )
}
