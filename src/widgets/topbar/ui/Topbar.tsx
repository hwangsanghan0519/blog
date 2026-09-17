import { Check, Download, Menu, Upload } from 'lucide-react'
import type { ChangeEvent, RefObject } from 'react'

type TopbarProps = {
  importRef: RefObject<HTMLInputElement | null>
  title: string
  onBackup: () => void
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenSidebar: () => void
}

export function Topbar({ importRef, title, onBackup, onImport, onOpenSidebar }: TopbarProps) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-only" type="button" onClick={onOpenSidebar}>
        <Menu size={19} />
      </button>
      <div>
        <p>SSEN 딜 스튜디오</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <span className="save-pill">
          <Check size={15} /> 자동 저장
        </span>
        <button className="ghost-action" type="button" onClick={onBackup}>
          <Download size={17} /> 백업
        </button>
        <button className="ghost-action" type="button" onClick={() => importRef.current?.click()}>
          <Upload size={17} /> 복원
        </button>
        <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={onImport} />
      </div>
    </header>
  )
}
