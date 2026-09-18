import { Eye, ImagePlus, Lock, PenLine, Play, Plus, Settings2, Trash2, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { BlogSidebar } from '../../../widgets/blog-sidebar/ui/BlogSidebar'
import { PostPreview } from '../../../widgets/post-preview/ui/PostPreview'
import { Topbar } from '../../../widgets/topbar/ui/Topbar'
import type { AdBannerSettings, HeroVideoSettings } from '../model/useBlogStudio'
import { GMARKET_SAMPLE_BANNER, GMARKET_SAMPLE_BANNER_IMAGE } from '../model/useBlogStudio'
import { useBlogStudio } from '../model/useBlogStudio'
import { PublicBlogHome } from './PublicBlogHome'

const PostEditor = lazy(async () => {
  const module = await import('../../../features/post-editor/ui/PostEditor')
  return { default: module.PostEditor }
})

export function BlogStudioPage() {
  const studio = useBlogStudio()
  const { activePost } = studio
  const isSecretAdminPath = isSecretPath(window.location.pathname)
  const secretUnlockAttemptedRef = useRef(false)

  useEffect(() => {
    if (isSecretAdminPath && !studio.ownerMode && !secretUnlockAttemptedRef.current) {
      secretUnlockAttemptedRef.current = true
      studio.unlockOwnerMode()
    }
  }, [isSecretAdminPath, studio])

  if (!studio.ownerMode) {
    return (
      <PublicBlogHome
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
      <BlogSidebar
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
          <HeroVideoAdminPanel settings={studio.heroVideo} onUpdate={studio.updateHeroVideo} />
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

function HeroVideoAdminPanel({
  settings,
  onUpdate,
}: {
  settings: HeroVideoSettings
  onUpdate: (patch: Partial<HeroVideoSettings>) => void
}) {
  return (
    <section className="ad-admin-panel hero-video-admin" aria-label="자동재생 영상 설정">
      <div>
        <span>TREND VIDEO</span>
        <strong>헤더 아래 풀 영상</strong>
      </div>

      <label className="ad-admin-toggle">
        <input
          checked={settings.enabled}
          type="checkbox"
          onChange={(event) => onUpdate({ enabled: event.target.checked, visibilityConfigured: true })}
        />
        노출
      </label>

      <label>
        영상 라벨
        <input value={settings.eyebrow} placeholder="NOW PLAYING" onChange={(event) => onUpdate({ eyebrow: event.target.value })} />
      </label>

      <label>
        영상 제목
        <input value={settings.title} placeholder="SSEN VIDEO PICK" onChange={(event) => onUpdate({ title: event.target.value })} />
      </label>

      <label className="ad-admin-wide hero-video-url-field">
        유튜브 주소
        <input
          inputMode="url"
          value={settings.youtubeUrl}
          placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
          onChange={(event) => {
            const youtubeUrl = event.target.value
            onUpdate({
              youtubeUrl,
              ...(!settings.visibilityConfigured ? { enabled: Boolean(youtubeUrl.trim()) } : {}),
            })
          }}
        />
        <small>주소를 등록하면 자동 노출됩니다. 직접 노출 스위치를 끈 이후에는 해당 설정을 유지합니다.</small>
      </label>
    </section>
  )
}

function isSecretPath(pathname: string) {
  return pathname === '/secret/sanghan' || pathname === '/blog/secret/sanghan'
}

function leaveOwnerMode(lockOwnerMode: () => void) {
  lockOwnerMode()
  window.history.pushState(null, '', window.location.pathname.startsWith('/blog') ? '/blog/' : '/')
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
      <label className="ad-admin-embed">
        <span>제휴 광고 태그</span>
        <textarea
          rows={5}
          spellCheck={false}
          value={banner.embedCode}
          placeholder={'쿠팡 등에서 발급받은 <script>…</script> 또는 <iframe>…</iframe> 코드를 붙여 넣으세요.'}
          onChange={(event) => onUpdate(index, { embedCode: event.target.value })}
        />
        <small>태그가 입력되면 이미지·텍스트 배너보다 우선 표시되며 광고 전용 보안 영역 안에서 실행됩니다.</small>
        {banner.embedCode && (
          <button type="button" onClick={() => onUpdate(index, { embedCode: '' })}>
            태그 비우기
          </button>
        )}
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
