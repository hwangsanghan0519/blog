import { Plus, Sparkles } from 'lucide-react'

type EmptyStateProps = {
  onCreate: () => void
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <main className="empty-state">
      <Sparkles size={42} />
      <h1>첫 글을 시작해볼까요?</h1>
      <button className="primary-action" type="button" onClick={onCreate}>
        <Plus size={18} /> 새 글 만들기
      </button>
    </main>
  )
}
