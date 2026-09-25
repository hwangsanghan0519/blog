import { Check, Download, Menu, Upload } from 'lucide-react'
import type { ChangeEvent, RefObject } from 'react'

type TopbarProps = {
  importRef: RefObject<HTMLInputElement | null>
  title: string
  saveStatus: string
  onRetrySave: () => void
  onBackup: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  sidebarOpen: boolean
  onOpenSidebar: () => void
}

export function Topbar({ importRef, title, saveStatus, onRetrySave, onBackup, onImport, sidebarOpen, onOpenSidebar }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-only" type="button" aria-label="상품 목록 열기" aria-expanded={sidebarOpen} aria-haspopup="dialog" onClick={onOpenSidebar}>
        <Menu size={19} />
      </button>
      <div className="admin-topbar-title">
        <p>파워퍼프셀럽 딜 스튜디오</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <span className={`save-pill${saveStatus.includes('실패') ? ' is-error' : ''}`} role="status">
          <Check size={15} /> {saveStatus}
        </span>
        {saveStatus.includes('실패') && <button className="ghost-action" type="button" onClick={onRetrySave}>다시 저장</button>}
        <details className="admin-backup-menu">
          <summary>백업 / 복원</summary>
          <div>
            <button className="ghost-action" type="button" onClick={onBackup}><Download size={17} /> 백업 다운로드</button>
            <button className="ghost-action" type="button" onClick={() => importRef.current?.click()}><Upload size={17} /> 백업 불러오기</button>
          </div>
        </details>
        <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={onImport} />
      </div>
    </header>
  )
}
