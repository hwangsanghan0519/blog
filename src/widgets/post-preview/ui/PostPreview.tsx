import { formatDate, statusLabel } from '../../../entities/post/lib/formatters'
import { normalizeEditorContent } from '../../../entities/post/lib/content'
import type { Post } from '../../../entities/post/model/types'

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
      <div className="rendered-content" dangerouslySetInnerHTML={{ __html: normalizeEditorContent(post.content) }} />
    </article>
  )
}
