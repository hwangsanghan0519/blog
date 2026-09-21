import { Camera, Clapperboard, ExternalLink, Sparkles, Tag, Tv, Video } from 'lucide-react'
import type { Post } from '../model/types'
import { productSourceLink } from '../lib/source'

const SOURCE_ICONS = { youtube: Video, instagram: Camera, daily: Camera, brand: Tag, broadcast: Tv, drama: Clapperboard, variety: Sparkles }

export function ProductSourceBadge({ post }: { post: Post }) {
  const source = productSourceLink(post.source)
  if (!source) return null
  const Icon = SOURCE_ICONS[source.type]
  return (
    <a
      className={`product-source-badge is-${source.type}`}
      href={source.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${post.title} ${source.label} 출처 보기 (새 창)`}
      data-keen-slider-clickable="true"
      onClick={(event) => event.stopPropagation()}
    >
      <Icon size={15} aria-hidden="true" />
      {source.label}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  )
}
