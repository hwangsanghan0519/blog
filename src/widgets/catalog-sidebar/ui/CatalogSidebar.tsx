import { useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ChevronDown, ChevronUp, FilePlus2, FolderPlus, GripVertical, ImagePlus, Pencil, Search, Trash2, X } from 'lucide-react'
import type { Post, PostStatusFilter } from '../../../entities/post/model/types'
import { formatDate, statusLabel } from '../../../entities/post/lib/formatters'

type CatalogSidebarProps = {
  activePostId: string
  categoryFilter: string
  categoryCounts: Array<{ name: string; count: number }>
  categoryImages: Record<string, string>
  isOpen: boolean
  posts: Post[]
  query: string
  statusFilter: PostStatusFilter
  totalPostCount: number
  onCategoryFilterChange: (category: string) => void
  onCreate: () => void
  onCreateCategory: () => void
  onCategoryImageUpload: (category: string, event: ChangeEvent<HTMLInputElement>) => void
  onClearCategoryImage: (category: string) => void
  onDeleteCategory: (category: string) => void
  onMoveCategory: (category: string, direction: -1 | 1) => void
  onReorderCategory: (category: string, targetCategory: string) => void
  onQueryChange: (query: string) => void
  onRenameCategory: (category: string) => void
  onSelectPost: (postId: string) => void
  onStatusFilterChange: (status: PostStatusFilter) => void
}

export function CatalogSidebar({
  activePostId,
  categoryFilter,
  categoryCounts,
  categoryImages,
  isOpen,
  posts,
  query,
  statusFilter,
  totalPostCount,
  onCategoryFilterChange,
  onCreate,
  onCreateCategory,
  onCategoryImageUpload,
  onClearCategoryImage,
  onDeleteCategory,
  onMoveCategory,
  onReorderCategory,
  onQueryChange,
  onRenameCategory,
  onSelectPost,
  onStatusFilterChange,
}: CatalogSidebarProps) {
  const [draggedCategory, setDraggedCategory] = useState('')
  const [dragOverCategory, setDragOverCategory] = useState('')

  const finishCategoryDrag = () => {
    setDraggedCategory('')
    setDragOverCategory('')
  }

  const dropCategory = (event: DragEvent<HTMLDivElement>, targetCategory: string) => {
    event.preventDefault()
    const sourceCategory = event.dataTransfer.getData('text/plain') || draggedCategory
    if (sourceCategory && sourceCategory !== targetCategory) {
      onReorderCategory(sourceCategory, targetCategory)
    }
    finishCategoryDrag()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">B</div>
        <div>
          <strong>파워퍼프셀럽 관리</strong>
          <span>상품 등록과 링크 관리</span>
        </div>
      </div>

      <button className="primary-action" type="button" onClick={onCreate}>
        <FilePlus2 size={18} /> 새 상품 등록
      </button>

      <label className="search-box">
        <Search size={17} />
        <input
          aria-label="상품 검색"
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

      <section className="category-manager" aria-label="셀럽 관리">
        <div className="sidebar-section-title">
          <span>셀럽 / 인플루언서</span>
          <button type="button" title="셀럽 추가" onClick={onCreateCategory}>
            <FolderPlus size={15} />
          </button>
        </div>

        <button
          className={`category-row ${categoryFilter === 'all' ? 'is-selected' : ''}`}
          type="button"
          onClick={() => onCategoryFilterChange('all')}
        >
          <span>전체 셀럽</span>
          <small>{totalPostCount}</small>
        </button>

        {categoryCounts.map((category, index) => (
          <div
            className={`category-row ${categoryFilter === category.name ? 'is-selected' : ''} ${draggedCategory === category.name ? 'is-dragging' : ''} ${dragOverCategory === category.name && draggedCategory !== category.name ? 'is-drag-over' : ''}`}
            draggable
            key={category.name}
            onDragStart={(event) => {
              setDraggedCategory(category.name)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', category.name)
            }}
            onDragEnd={finishCategoryDrag}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDragOverCategory(category.name)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverCategory('')
            }}
            onDrop={(event) => dropCategory(event, category.name)}
          >
            <button type="button" onClick={() => onCategoryFilterChange(category.name)}>
              <span className="category-thumb">
                {categoryImages[category.name] ? <img src={categoryImages[category.name]} alt="" draggable={false} /> : category.name.slice(0, 1)}
              </span>
              <span>{category.name}</span>
              <small>{category.count}</small>
            </button>
            <div className="category-actions">
              <span
                className="category-drag-handle"
                aria-label="드래그해서 순서 변경"
                role="img"
                title="드래그해서 순서 변경"
              >
                <GripVertical size={14} />
              </span>
              <button
                className="category-order-button"
                type="button"
                title="위로 이동"
                disabled={index === 0}
                onClick={() => onMoveCategory(category.name, -1)}
              >
                <ChevronUp size={13} />
              </button>
              <button
                className="category-order-button"
                type="button"
                title="아래로 이동"
                disabled={index === categoryCounts.length - 1}
                onClick={() => onMoveCategory(category.name, 1)}
              >
                <ChevronDown size={13} />
              </button>
              <label title="셀럽 사진 첨부">
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

      <section className="post-list-section" aria-label="수정할 상품 선택">
        <div className="post-list-header">
          <strong>{categoryFilter === 'all' ? '전체 상품' : categoryFilter}</strong>
          <small>{posts.length}개 · 최근 수정순</small>
        </div>

        {posts.length > 0 ? (
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
                    {post.category && `${post.category} · `}{formatDate(post.updatedAt)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sidebar-empty-posts">
            <p>조건에 맞는 상품이 없습니다.</p>
            <button type="button" onClick={onCreate}>
              <FilePlus2 size={15} />
              {categoryFilter === 'all' ? '새 상품 등록' : `${categoryFilter}에 상품 등록`}
            </button>
          </div>
        )}
      </section>
    </aside>
  )
}
