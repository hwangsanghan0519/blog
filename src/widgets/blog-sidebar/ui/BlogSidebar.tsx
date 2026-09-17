import type { ChangeEvent } from 'react'
import { FilePlus2, FolderPlus, ImagePlus, Pencil, Search, Trash2, X } from 'lucide-react'
import type { Post, PostStatusFilter } from '../../../entities/post/model/types'
import { formatDate, statusLabel } from '../../../entities/post/lib/formatters'

type BlogSidebarProps = {
  activePostId: string
  categoryFilter: string
  categoryCounts: Array<{ name: string; count: number }>
  categoryImages: Record<string, string>
  isOpen: boolean
  posts: Post[]
  query: string
  statusFilter: PostStatusFilter
  onCategoryFilterChange: (category: string) => void
  onCreate: () => void
  onCreateCategory: () => void
  onCategoryImageUpload: (category: string, event: ChangeEvent<HTMLInputElement>) => void
  onClearCategoryImage: (category: string) => void
  onDeleteCategory: (category: string) => void
  onQueryChange: (query: string) => void
  onRenameCategory: (category: string) => void
  onSelectPost: (postId: string) => void
  onStatusFilterChange: (status: PostStatusFilter) => void
}

export function BlogSidebar({
  activePostId,
  categoryFilter,
  categoryCounts,
  categoryImages,
  isOpen,
  posts,
  query,
  statusFilter,
  onCategoryFilterChange,
  onCreate,
  onCreateCategory,
  onCategoryImageUpload,
  onClearCategoryImage,
  onDeleteCategory,
  onQueryChange,
  onRenameCategory,
  onSelectPost,
  onStatusFilterChange,
}: BlogSidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">B</div>
        <div>
          <strong>SSEN 관리</strong>
          <span>상품 등록과 링크 관리</span>
        </div>
      </div>

      <button className="primary-action" type="button" onClick={onCreate}>
        <FilePlus2 size={18} /> 새 상품 등록
      </button>

      <label className="search-box">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="상품명, 쇼핑몰, 태그 검색"
        />
      </label>

      <div className="filter-group" aria-label="상품 상태 필터">
        {(['all', 'published', 'draft', 'archived'] as const).map((status) => (
          <button
            className={statusFilter === status ? 'is-active' : ''}
            key={status}
            type="button"
            onClick={() => onStatusFilterChange(status)}
          >
            {statusLabel(status)}
          </button>
        ))}
      </div>

      <section className="category-manager" aria-label="카테고리 관리">
        <div className="sidebar-section-title">
          <span>카테고리</span>
          <button type="button" title="카테고리 추가" onClick={onCreateCategory}>
            <FolderPlus size={15} />
          </button>
        </div>

        <button
          className={`category-row ${categoryFilter === 'all' ? 'is-selected' : ''}`}
          type="button"
          onClick={() => onCategoryFilterChange('all')}
        >
          <span>전체</span>
          <small>{categoryCounts.reduce((sum, category) => sum + category.count, 0)}</small>
        </button>

        {categoryCounts.map((category) => (
          <div className={`category-row ${categoryFilter === category.name ? 'is-selected' : ''}`} key={category.name}>
            <button type="button" onClick={() => onCategoryFilterChange(category.name)}>
              <span className="category-thumb">
                {categoryImages[category.name] ? <img src={categoryImages[category.name]} alt="" /> : category.name.slice(0, 1)}
              </span>
              <span>{category.name}</span>
              <small>{category.count}</small>
            </button>
            <div className="category-actions">
              <label title="카테고리 사진 첨부">
                <ImagePlus size={13} />
                <input accept="image/*" type="file" onChange={(event) => onCategoryImageUpload(category.name, event)} />
              </label>
              {categoryImages[category.name] && (
                <button type="button" title="사진 삭제" onClick={() => onClearCategoryImage(category.name)}>
                  <X size={13} />
                </button>
              )}
              <button type="button" title="이름 변경" onClick={() => onRenameCategory(category.name)}>
                <Pencil size={13} />
              </button>
              <button type="button" title="삭제" onClick={() => onDeleteCategory(category.name)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="post-list">
        {posts.map((post) => (
          <button
            className={`post-row ${post.id === activePostId ? 'is-selected' : ''}`}
            key={post.id}
            type="button"
            onClick={() => onSelectPost(post.id)}
          >
            <span className={`status-dot ${post.status}`} />
            <span>
              <strong>{post.title}</strong>
              <small>
                {post.category || '분류 없음'} · {formatDate(post.updatedAt)}
              </small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
