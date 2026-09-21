import { Camera, Clapperboard, Sparkles, Tag, Tv } from 'lucide-react'
import type { Post } from '../model/types'
import { productSourceLink } from '../lib/source'
import { InstagramSourceIcon, YoutubeSourceIcon } from './ProductSourceIcons'

const SOURCE_ICONS = { youtube: YoutubeSourceIcon, instagram: InstagramSourceIcon, daily: Camera, brand: Tag, broadcast: Tv, drama: Clapperboard, variety: Sparkles }

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
      title={`${source.label} 출처 보기`}
      data-keen-slider-clickable="true"
      onClick={(event) => event.stopPropagation()}
    >
      <Icon size={18} aria-hidden="true" />
    </a>
  )
}
