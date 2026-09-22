import { ProductSourceBadge } from '../../../entities/post/ui/ProductSourceBadge'
import { formatDate, statusLabel } from '../../../entities/post/lib/formatters'
import type { Post } from '../../../entities/post/model/types'
import { RenderedContent } from '../../../shared/ui/RenderedContent'

type PostPreviewProps = {
  post: Post
}

export function PostPreview({ post }: PostPreviewProps) {
  const previewImages = [post.coverImage, ...post.detailImages].filter(Boolean)

  return (
    <article className="preview">
      {previewImages.length > 0 && (
        <div className="preview-image-strip" aria-label="상품 이미지 미리보기">
          <ProductSourceBadge post={post} />
          {previewImages.map((image, index) => (
            <img className="preview-cover" src={image} alt={`${post.title} ${index === 0 ? '대표' : `상세 ${index}`} 이미지`} key={`${image.slice(0, 48)}-${index}`} />
          ))}
        </div>
      )}
      <span className={`status-badge ${post.status}`}>{statusLabel(post.status)}</span>
      <h2>{post.title}</h2>
      <p className="preview-excerpt">{post.excerpt}</p>
      <div className="preview-meta">
        {post.category} · {formatDate(post.updatedAt)} · {post.tags.join(', ')}
      </div>
      <RenderedContent content={post.content} />
      {post.productLinks.length > 0 && (
        <section className="preview-product-links">
          <h3>제휴 링크</h3>
          {post.productLinks.map((link) => (
            <a href={link.href || undefined} key={link.id} target="_blank" rel="noreferrer sponsored">
              <span>{link.mall || '쇼핑몰'}</span>
              <strong>{link.price || '가격 확인'}</strong>
              <small>보러가기</small>
            </a>
          ))}
        </section>
      )}
    </article>
  )
}
