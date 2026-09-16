import { Eye, ImagePlus, Lock, PenLine, Plus, Trash2, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { PostEditor } from '../../../features/post-editor/ui/PostEditor'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { BlogSidebar } from '../../../widgets/blog-sidebar/ui/BlogSidebar'
import { FloatingActionMenu } from '../../../widgets/floating-actions/ui/FloatingActionMenu'
import { PostPreview } from '../../../widgets/post-preview/ui/PostPreview'
import { Topbar } from '../../../widgets/topbar/ui/Topbar'
import type { AdBannerSettings } from '../model/useBlogStudio'
import { GMARKET_SAMPLE_BANNER, GMARKET_SAMPLE_BANNER_IMAGE } from '../model/useBlogStudio'
import { useBlogStudio } from '../model/useBlogStudio'
import { PublicBlogHome } from './PublicBlogHome'

export function BlogStudioPage() {
  const studio = useBlogStudio()
  const { activePost } = studio

  if (!studio.ownerMode) {
    return (
      <PublicBlogHome
        adBanners={studio.adBanners}
        categories={studio.categories}
        categoryFilter={studio.categoryFilter}
        posts={studio.posts}
        onCategoryFilterChange={studio.setCategoryFilter}
        onEnterOwnerMode={studio.unlockOwnerMode}
      />
    )
  }

  if (!activePost) {
    return <EmptyState onCreate={studio.createPost} />
  }

  return (
    <div className="app-shell">
      <BlogSidebar
        activePostId={activePost.id}
        categoryCounts={studio.categoryCounts}
        categoryFilter={studio.categoryFilter}
        isOpen={studio.sidebarOpen}
        posts={studio.filteredPosts}
        query={studio.query}
        statusFilter={studio.statusFilter}
        onCategoryFilterChange={studio.setCategoryFilter}
        onCreate={studio.createPost}
        onCreateCategory={studio.createCategory}
        onDeleteCategory={studio.deleteCategory}
        onQueryChange={studio.setQuery}
        onRenameCategory={studio.renameCategory}
        onSelectPost={(postId) => {
          studio.setActiveId(postId)
          studio.setView('editor')
          studio.setSidebarOpen(false)
        }}
        onStatusFilterChange={studio.setStatusFilter}
      />

      <main className="workspace">
        <Topbar
          importRef={studio.importRef}
          title={activePost.title}
          onBackup={studio.exportBackup}
          onImport={studio.importBackup}
          onOpenSidebar={() => studio.setSidebarOpen(true)}
          onToggleTheme={() => studio.setDarkMode((value) => !value)}
        />

        <button className="owner-mode-pill" type="button" onClick={studio.lockOwnerMode}>
          <Lock size={16} /> 읽기 화면으로
        </button>

        <nav className="view-tabs compact-view-tabs" aria-label="작성 화면">
          <button className={studio.view === 'editor' ? 'is-active' : ''} type="button" onClick={() => studio.setView('editor')}>
            쓰기
          </button>
          <button className={studio.view === 'preview' ? 'is-active' : ''} type="button" onClick={() => studio.setView('preview')}>
            미리보기
          </button>
        </nav>

        <div className="ad-admin-stack">
          {studio.adBanners.map((banner, index) => (
            <AdBannerAdminPanel
              banner={banner}
              index={index}
              key={banner.id}
              onImageUpload={studio.handleAdBannerImageUpload}
              onUpdate={studio.updateAdBanner}
            />
          ))}
        </div>

        {studio.view !== 'preview' && (
          <PostEditor
            categories={studio.categories}
            post={activePost}
            onCoverUpload={studio.handleCoverUpload}
            onUpdate={studio.updatePost}
          />
        )}

        {studio.view === 'preview' && <PostPreview post={activePost} />}

        <nav className="app-dock" aria-label="빠른 이동">
          <button className={studio.view === 'editor' ? 'is-active' : ''} type="button" onClick={() => studio.setView('editor')}>
            <PenLine size={18} /> 쓰기
          </button>
          <button className={studio.view === 'preview' ? 'is-active' : ''} type="button" onClick={() => studio.setView('preview')}>
            <Eye size={18} /> 미리보기
          </button>
          <button type="button" onClick={() => studio.createPost()}>
            <Plus size={18} /> 새 글
          </button>
        </nav>

        <FloatingActionMenu
          onBackup={studio.exportBackup}
          onCreate={studio.createPost}
          onToggleTheme={() => studio.setDarkMode((value) => !value)}
          onWrite={() => studio.setView('editor')}
        />
      </main>

      {studio.sidebarOpen && (
        <button className="scrim" type="button" aria-label="메뉴 닫기" onClick={() => studio.setSidebarOpen(false)}>
          <X size={22} />
        </button>
      )}
    </div>
  )
}

function AdBannerAdminPanel({
  banner,
  index,
  onImageUpload,
  onUpdate,
}: {
  banner: AdBannerSettings
  index: number
  onImageUpload: (index: number, event: ChangeEvent<HTMLInputElement>) => void
  onUpdate: (index: number, patch: Partial<AdBannerSettings>) => void
}) {
  const colorPickerValue = /^#[0-9a-fA-F]{6}$/.test(banner.backgroundColor) ? banner.backgroundColor : '#ffffff'
  const usesDefaultBannerImage = banner.image === GMARKET_SAMPLE_BANNER_IMAGE

  return (
    <section className="ad-admin-panel" aria-label="띠배너 설정">
      <div>
        <span>광고 띠배너 {index + 1}</span>
        <strong>배너 슬롯 {index + 1}</strong>
      </div>

      <label className="ad-admin-toggle">
        <input checked={banner.enabled} type="checkbox" onChange={(event) => onUpdate(index, { enabled: event.target.checked })} />
        노출
      </label>

      <label>
        위치
        <select value={banner.placement} onChange={(event) => onUpdate(index, { placement: event.target.value as AdBannerSettings['placement'] })}>
          <option value="both">헤더+푸터</option>
          <option value="header">헤더 아래</option>
          <option value="footer">푸터 위</option>
        </select>
      </label>

      <label>
        라벨
        <input value={banner.eyebrow} onChange={(event) => onUpdate(index, { eyebrow: event.target.value })} />
      </label>
      <label>
        제목
        <input value={banner.title} onChange={(event) => onUpdate(index, { title: event.target.value })} />
      </label>
      <label className="ad-admin-wide">
        설명
        <input value={banner.description} onChange={(event) => onUpdate(index, { description: event.target.value })} />
      </label>
      <label>
        버튼 문구
        <input value={banner.ctaLabel} onChange={(event) => onUpdate(index, { ctaLabel: event.target.value })} />
      </label>
      <label className="ad-admin-wide">
        링크
        <input value={banner.href} placeholder="https://example.com" onChange={(event) => onUpdate(index, { href: event.target.value })} />
      </label>
      <label className="ad-admin-color">
        배경색
        <span>
          <input type="color" value={colorPickerValue} onChange={(event) => onUpdate(index, { backgroundColor: event.target.value })} />
          <input value={banner.backgroundColor} onChange={(event) => onUpdate(index, { backgroundColor: event.target.value })} />
        </span>
      </label>
      <label className="ad-admin-preset">
        <input
          checked={usesDefaultBannerImage}
          type="checkbox"
          onChange={(event) =>
            onUpdate(
              index,
              event.target.checked
                ? {
                    enabled: true,
                    image: GMARKET_SAMPLE_BANNER_IMAGE,
                    backgroundColor: GMARKET_SAMPLE_BANNER.backgroundColor ?? '#35c5f0',
                  }
                : { image: '' },
            )
          }
        />
        기본 배너 이미지 사용
      </label>
      <label className="ad-admin-image">
        <span>배너 이미지</span>
        <input type="file" accept="image/*" onChange={(event) => onImageUpload(index, event)} />
        {banner.image ? <img src={banner.image} alt="" /> : <ImagePlus size={24} />}
      </label>
      {banner.image && (
        <button className="ad-admin-remove" type="button" onClick={() => onUpdate(index, { image: '' })}>
          <Trash2 size={16} /> 이미지 삭제
        </button>
      )}
    </section>
  )
}
