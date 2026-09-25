import * as Dialog from '@radix-ui/react-dialog'
import { BarChart3, Eye, Lock, PenLine, Play, Plus, Settings2, X, Menu } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { CatalogSidebar } from '../../../widgets/catalog-sidebar/ui/CatalogSidebar'
import { PostPreview } from '../../../widgets/post-preview/ui/PostPreview'
import { Topbar } from '../../../widgets/topbar/ui/Topbar'
import { useCommerceStudio } from '../model/useCommerceStudio'
import { useInitialLoading } from '../lib/useInitialLoading'
import { AdBannerAdminPanel, HeroVideoAdminPanel } from './AdminSettingsPanels'
import { StorefrontHome } from './StorefrontHome'
import { StorefrontSkeleton } from './StorefrontSkeleton'

const PostEditor = lazy(async () => {
  const module = await import('../../../features/post-editor/ui/PostEditor')
  return { default: module.PostEditor }
})

const AnalyticsDashboard = lazy(async () => {
  const module = await import('./AnalyticsDashboard')
  return { default: module.AnalyticsDashboard }
})

export function CommerceStudioPage() {
  const studio = useCommerceStudio()
  useInitialLoading(studio.cloudReady)
  const { activePost } = studio
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [compactAdmin, setCompactAdmin] = useState(() => window.matchMedia('(max-width: 1120px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1120px)')
    const update = () => setCompactAdmin(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (studio.ownerMode && compactAdmin) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [activePost?.id, studio.ownerMode, compactAdmin])
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const updateKeyboard = () => setKeyboardOpen(window.innerHeight - viewport.height > 150)
    viewport.addEventListener('resize', updateKeyboard)
    return () => viewport.removeEventListener('resize', updateKeyboard)
  }, [])
  const isSecretAdminPath = isSecretPath(window.location.pathname)

  useEffect(() => {
    if (!isSecretAdminPath) return

    document.title = '파워퍼프셀럽 관리자'
    setRobotsMeta('robots', 'noindex,nofollow,noarchive')
    setRobotsMeta('googlebot', 'noindex,nofollow,noarchive')
  }, [isSecretAdminPath, studio.ownerMode])

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

  if (!studio.cloudSynced) {
    return <main className="workspace"><h1>서버 데이터를 불러오지 못했습니다</h1><p>연결을 확인한 뒤 다시 불러오면 바로 편집할 수 있습니다.</p><button className="ghost-action" type="button" onClick={() => window.location.reload()}>다시 불러오기</button></main>
  }

  const catalog = (
      <CatalogSidebar
        activePostId={activePost?.id ?? ''}
        categoryCounts={studio.categoryCounts}
        categoryImages={studio.categoryImages}
        categoryFilter={studio.categoryFilter}
        isOpen={studio.sidebarOpen}
        posts={studio.filteredPosts}
        totalPostCount={studio.posts.length}
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
  )

  return (
    <div className={`app-shell${keyboardOpen ? ' is-keyboard-open' : ''}`}>
      {compactAdmin ? <Dialog.Root open={studio.sidebarOpen} onOpenChange={studio.setSidebarOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="admin-catalog-overlay" />
          <Dialog.Content className="admin-catalog-dialog" onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.querySelector<HTMLButtonElement>('.topbar [aria-haspopup="dialog"]')?.focus({ preventScroll: true })
          }}>
            <div className="admin-catalog-heading"><Dialog.Title>상품 · 셀럽 관리</Dialog.Title><Dialog.Close className="icon-button" aria-label="상품 목록 닫기"><X size={20} /></Dialog.Close></div>
            <Dialog.Description className="admin-catalog-description">상품을 선택하거나 새 상품을 등록하세요.</Dialog.Description>
            {catalog}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root> : catalog}
      <main className="workspace">
        <Topbar
          importRef={studio.importRef}
          saveStatus={studio.saveStatus}
          onRetrySave={studio.retrySave}
          title={studio.view === 'analytics' ? '방문 · 상품 통계' : activePost?.title ?? '상품 관리'}
          onBackup={studio.exportBackup}
          onImport={studio.importBackup}
          sidebarOpen={studio.sidebarOpen}
          onOpenSidebar={() => studio.setSidebarOpen(true)}
        />

        <section className="admin-command-bar" aria-label="관리자 작업">
          <nav className="view-tabs compact-view-tabs" aria-label="작성 화면">
            <button className={studio.view === 'analytics' ? 'is-active' : ''} type="button" onClick={() => studio.setView('analytics')}>
              <BarChart3 size={16} /> 통계 대시보드
            </button>
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
            <button className="ghost-action" type="button" disabled={studio.saveStatus !== '서버 저장됨'} onClick={() => leaveOwnerMode(studio.lockOwnerMode)}>
              <Lock size={16} /> 쇼핑 화면
            </button>
          </div>
        </section>

        {studio.view === 'analytics' && <Suspense fallback={<p role="status">대시보드를 불러오는 중…</p>}><AnalyticsDashboard /></Suspense>}

        {!activePost && studio.view !== 'analytics' && <EmptyState onCreate={() => studio.createPost()} />}

        {activePost && studio.view === 'editor' && (
          <Suspense fallback={null}>
            <PostEditor
              key={activePost.id}
              categories={studio.categories}
              post={activePost}
              onCoverUpload={studio.handleCoverUpload}
              onUpdate={studio.updatePost}
            />
          </Suspense>
        )}

        {activePost && studio.view === 'preview' && <PostPreview post={activePost} />}

        {studio.view !== 'analytics' && <>
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

        </>}


      </main>

      <nav className="admin-mobile-dock" aria-label="모바일 관리자 작업">
        <button type="button" onClick={() => studio.setSidebarOpen(true)}><Menu size={19} /> 상품 목록</button>
        <button type="button" className="is-primary" onClick={() => studio.createPost()}><Plus size={20} /> 새 상품 등록</button>
        <button type="button" disabled={!activePost} onClick={() => { studio.setView(studio.view === 'preview' ? 'editor' : 'preview'); window.scrollTo({ top: 0, behavior: 'instant' }) }}><Eye size={19} /> {studio.view === 'preview' ? '편집하기' : '미리보기'}</button>
      </nav>
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
