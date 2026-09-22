import type { Post } from '../../../entities/post/model/types'
import { getProductSeo } from '../../../shared/lib/product-seo'
import { getPublicSiteOrigin } from '../../../shared/lib/seo'

export function ProductSeoPreview({ post }: { post: Post }) {
  const seo = getProductSeo(post, getPublicSiteOrigin())
  return (
    <section className="product-seo-preview" aria-label="검색 결과 미리보기">
      <h3>검색 결과 미리보기</h3>
      <small>{seo.canonical}</small>
      <strong>{seo.pageTitle}</strong>
      <p>{seo.description}</p>
      <footer>제목·상품 소개·셀럽·태그로 자동 구성됩니다. 실제 검색 결과는 검색엔진에 따라 달라질 수 있습니다.</footer>
    </section>
  )
}
