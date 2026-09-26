import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { InstagramSourceIcon as Instagram } from '../../../entities/post/ui/ProductSourceIcons'
import { parseCelebAccounts } from '../model/celebAccounts'
import type { CelebAccount } from '../model/celebStoryTypes'
import './celeb-stories.css'

type Props = { accounts: CelebAccount[]; onSave: (accounts: CelebAccount[]) => void }
export function CelebStoriesAdminPanel({ accounts, onSave }: Props) {
  const [draft, setDraft] = useState(accounts)
  const [message, setMessage] = useState('')
  const update = (index: number, field: keyof CelebAccount, value: string) => {
    setDraft(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row))
    setMessage('')
  }
  const move = (index: number, step: number) => {
    const next = [...draft]
    ;[next[index], next[index + step]] = [next[index + step], next[index]]
    setDraft(next)
    setMessage('')
  }
  const save = () => {
    try { const next = parseCelebAccounts(draft); onSave(next); setDraft(next); setMessage('변경을 적용했습니다. 상단의 서버 저장 상태를 확인해 주세요.') }
    catch (error) { setMessage(error instanceof Error ? error.message : '입력을 확인해 주세요.') }
  }
  return <details className="admin-settings-panel celeb-admin-panel">
    <summary><span><Instagram size={17} /> 셀럽스토리 관리</span><small>셀럽 등록 · 노출 순서 · 인스타 연결</small></summary>
    <div className="celeb-admin-body">
      <p>이름과 인스타 아이디 또는 프로필 주소를 입력하세요. 프로필 사진과 팔로워 수를 자동으로 불러옵니다.</p>
      <p className="celeb-admin-hint">이름을 기존 셀럽 카테고리와 맞추면 등록된 사진을 대체 이미지로 사용합니다. 조회할 수 없는 계정은 ???로 표시됩니다.</p>
      <div className="celeb-admin-rows">{draft.map((account, index) => <div className="celeb-admin-row" key={index}>
        <span className="celeb-admin-index">{String(index + 1).padStart(2, '0')}</span>
        <label>셀럽 이름<input maxLength={50} value={account.name} placeholder="예: 수영" onChange={e => update(index, 'name', e.target.value)} /></label>
        <label>인스타 아이디 / 주소<input value={account.username} placeholder="@sooyoungchoi" autoCapitalize="none" spellCheck={false} onChange={e => update(index, 'username', e.target.value)} /></label>
        <div className="celeb-admin-row-actions">
          <button type="button" aria-label={`${account.name || index + 1} 위로 이동`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
          <button type="button" aria-label={`${account.name || index + 1} 아래로 이동`} disabled={index === draft.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
          <button type="button" aria-label={`${account.name || index + 1} 등록 삭제`} onClick={() => { setDraft(rows => rows.filter((_, i) => i !== index)); setMessage('') }}><Trash2 size={16} /></button>
        </div>
      </div>)}</div>
      {!draft.length && <p>등록된 셀럽이 없으면 홈에서 셀럽스토리가 숨겨집니다.</p>}
      <div className="celeb-admin-actions"><button className="ghost-action" type="button" disabled={draft.length >= 30} onClick={() => { setDraft([...draft, { name: '', username: '' }]); setMessage('') }}><Plus size={16} /> 셀럽 추가</button><button className="primary-action" type="button" onClick={save}>변경 적용</button></div>
      <p role="status">{message || `${draft.length} / 30명 · 변경 적용 후 서버에 자동 저장됩니다.`}</p>
    </div>
  </details>
}
