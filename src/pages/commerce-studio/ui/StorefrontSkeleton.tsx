import './storefront-skeleton.css'

const CATEGORY_PLACEHOLDERS = Array.from({ length: 12 }, (_, index) => index)

/** 첫 원격 스냅샷이 확정될 때까지 샘플 데이터 대신 최종 화면의 공간 구조를 유지합니다. */
export function StorefrontSkeleton() {
  return (
    <div className="storefront-skeleton" aria-busy="true" aria-live="polite">
      <p className="storefront-skeleton-status">상품을 불러오는 중입니다.</p>
      <div className="storefront-skeleton-ad skeleton-shimmer" />
      <header className="storefront-skeleton-header">
        <div className="storefront-skeleton-brand">
          <span className="skeleton-shimmer" />
          <strong className="skeleton-shimmer" />
          <i className="skeleton-shimmer" />
        </div>
        <div className="storefront-skeleton-categories" aria-hidden="true">
          {CATEGORY_PLACEHOLDERS.map((item) => <span className="skeleton-shimmer" key={item} />)}
        </div>
      </header>
      <div className="storefront-skeleton-video skeleton-shimmer" />
      <main className="storefront-skeleton-content">
        <section className="storefront-skeleton-best">
          <div>
            <span className="skeleton-shimmer" />
            <strong className="skeleton-shimmer" />
            <i className="skeleton-shimmer" />
          </div>
          <div className="skeleton-shimmer" />
        </section>
        <section className="storefront-skeleton-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, item) => <span className="skeleton-shimmer" key={item} />)}
        </section>
      </main>
    </div>
  )
}
