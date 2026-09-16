import { BookOpen, LayoutDashboard, PenLine, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

type StatsGridProps = {
  stats: {
    total: number
    published: number
    drafts: number
    words: number
  }
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <section className="stats-grid" aria-label="블로그 통계">
      <Stat label="전체 글" value={stats.total} icon={<LayoutDashboard size={20} />} />
      <Stat label="발행됨" value={stats.published} icon={<BookOpen size={20} />} />
      <Stat label="초안" value={stats.drafts} icon={<PenLine size={20} />} />
      <Stat label="누적 단어" value={stats.words} icon={<Sparkles size={20} />} />
    </section>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="stat-card">
      {icon}
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  )
}
