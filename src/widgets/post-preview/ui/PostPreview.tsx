import { formatDate, statusLabel } from '../../../entities/post/lib/formatters'
import type { Post } from '../../../entities/post/model/types'
import { RenderedContent } from '../../../shared/ui/RenderedContent'

type PostPreviewProps = {
  post: Post
}

export function PostPreview({ post }: PostPreviewProps) {
  return (
    <article className="preview">
      {post.coverImage && <img className="preview-cover" src={post.coverImage} alt="" />}
      <span className={`status-badge ${post.status}`}>{statusLabel(post.status)}</span>
      <h2>{post.title}</h2>
      <p className="preview-excerpt">{post.excerpt}</p>
      <div className="preview-meta">
        {post.category} · {formatDate(post.updatedAt)} · {post.tags.join(', ')}
      </div>
      <RenderedContent content={post.content} />
    </article>
  )
}
