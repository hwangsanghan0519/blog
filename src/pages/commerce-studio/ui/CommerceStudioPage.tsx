import { Eye, Lock, PenLine, Play, Plus, Settings2, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { CatalogSidebar } from '../../../widgets/catalog-sidebar/ui/CatalogSidebar'
import { PostPreview } from '../../../widgets/post-preview/ui/PostPreview'
import { Topbar } from '../../../widgets/topbar/ui/Topbar'
import { useCommerceStudio } from '../model/useCommerceStudio'
import { AdBannerAdminPanel, HeroVideoAdminPanel } from './AdminSettingsPanels'
import { StorefrontHome } from './StorefrontHome'
import { StorefrontSkeleton } from './StorefrontSkeleton'

const PostEditor = lazy(async () => {
  const module = await import('../../../features/post-editor/ui/PostEditor')
  return { default: module.PostEditor }
})

export function CommerceStudioPage() {
  const studio = useCommerceStudio()
  const { activePost } = studio
  const isSecretAdminPath = isSecretPath(window.location.pathname)
  const secretUnlockAttemptedRef = useRef(false)

  useEffect(() => {
    if (!isSecretAdminPath) return

    document.title = '파워퍼프셀럽 관리자'
    setRobotsMeta('robots', 'noindex,nofollow,noarchive')
    setRobotsMeta('googlebot', 'noindex,nofollow,noarchive')
  }, [isSecretAdminPath, studio.ownerMode])

  useEffect(() => {
    if (isSecretAdminPath && !studio.ownerMode && !secretUnlockAttemptedRef.current) {
      secretUnlockAttemptedRef.current = true
      studio.unlockOwnerMode()
    }
  }, [isSecretAdminPath, studio])

  if (!studio.cloudReady) {
    return <StorefrontSkeleton />
  }

  if (!studio.ownerMode) {
    return (
      <StorefrontHome
        adBanners={studio.adBanners}
        categories={studio.categories}
        categoryImages={studio.categoryImages}
        categoryFilter={studio.categoryFilter}
        heroVideo={studio.heroVideo}
        posts={studio.posts}
        onCategoryFilterChange={studio.setCategoryFilter}
        onRequestPost={studio.loadPostDetail}
      />
    )
  }

  if (!activePost) {
    return <EmptyState onCreate={() => studio.createPost()} />
  }

  return (
    <div className="app-shell">
      <CatalogSidebar
        activePostId={activePost.id}
        categoryCounts={studio.categoryCounts}
        categoryImages={studio.categoryImages}
        categoryFilter={studio.categoryFilter}
        isOpen={studio.sidebarOpen}
        posts={studio.filteredPosts}
        query={studio.query}
        statusFilter={studio.statusFilter}
        onCategoryFilterChange={studio.selectAdminCategory}
        onCreate={() => studio.createPost()}
        onCreateCategory={studio.createCategory}
        onDeleteCategory={studio.deleteCategory}
        onMoveCategory={studio.moveCategory}
        onReorderCategory={studio.reorderCategory}
        onCategoryImageUpload={studio.handleCategoryImageUpload}
        onClearCategoryImage={studio.clearCategoryImage}
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
        />

        <section className="admin-command-bar" aria-label="관리자 작업">
          <nav className="view-tabs compact-view-tabs" aria-label="작성 화면">
            <button className={studio.view === 'editor' ? 'is-active' : ''} type="button" onClick={() => studio.setView('editor')}>
              <PenLine size={16} /> 상품 편집
            </button>
            <button className={studio.view === 'preview' ? 'is-active' : ''} type="button" onClick={() => studio.setView('preview')}>
              <Eye size={16} /> 미리보기
            </button>
          </nav>

          <div className="admin-command-actions">
            <button className="ghost-action" type="button" onClick={() => studio.createPost()}>
              <Plus size={17} /> 새 상품
            </button>
            <button className="ghost-action" type="button" onClick={() => leaveOwnerMode(studio.lockOwnerMode)}>
              <Lock size={16} /> 쇼핑 화면
            </button>
          </div>
        </section>

        <details className="admin-settings-panel">
          <summary>
            <span>
              <Settings2 size={17} /> 광고 띠배너 설정
            </span>
            <small>최대 2개 배너, 위치/이미지/링크 관리</small>
          </summary>
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
        </details>

        <details className="admin-settings-panel">
          <summary>
            <span>
              <Play size={17} /> 자동재생 영상 설정
            </span>
            <small>유튜브 주소 등록 · 무음 자동재생 · 반복 재생</small>
          </summary>
          <HeroVideoAdminPanel
            settings={studio.heroVideo}
            onStickerImageUpload={studio.handleHeroVideoStickerUpload}
            onUpdate={studio.updateHeroVideo}
          />
        </details>

        {studio.view !== 'preview' && (
          <Suspense fallback={null}>
            <PostEditor
              categories={studio.categories}
              post={activePost}
              onCoverUpload={studio.handleCoverUpload}
              onUpdate={studio.updatePost}
            />
          </Suspense>
        )}

        {studio.view === 'preview' && <PostPreview post={activePost} />}

      </main>

      {studio.sidebarOpen && (
        <button className="scrim" type="button" aria-label="메뉴 닫기" onClick={() => studio.setSidebarOpen(false)}>
          <X size={22} />
        </button>
      )}
    </div>
  )
}

function isSecretPath(pathname: string) {
  return pathname === '/secret/sanghan' || pathname === '/blog/secret/sanghan'
}

function setRobotsMeta(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.append(meta)
  }
  meta.content = content
}

function leaveOwnerMode(lockOwnerMode: () => void) {
  lockOwnerMode()
  window.history.pushState(null, '', window.location.pathname.startsWith('/blog') ? '/blog/' : '/')
}
