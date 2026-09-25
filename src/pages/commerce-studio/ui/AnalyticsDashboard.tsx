import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, BarChart3, MousePointer2, RefreshCw, Users } from 'lucide-react'
import { hasAnalyticsMeasurementId } from '../../../shared/lib/analytics'
import { fetchAnalytics } from '../api/analyticsApi'
import type { AnalyticsDays, AnalyticsSnapshot } from '../model/analyticsTypes'
import './analytics-dashboard.css'

const number = new Intl.NumberFormat('ko-KR')

export function AnalyticsDashboard() {
  const [days, setDays] = useState<AnalyticsDays>(30)
  const [refresh, setRefresh] = useState(0)
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    let disposed = false
    void fetchAnalytics(days, controller.signal)
      .then((data) => { if (!disposed) setSnapshot(data) })
      .catch((reason) => {
        if (!disposed) setError(controller.signal.aborted ? '조회 시간이 초과되었습니다. 다시 시도해 주세요.' : reason instanceof Error ? reason.message : '통계를 불러오지 못했습니다.')
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!disposed) setLoading(false)
      })
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort() }
  }, [days, refresh])

  const reload = (nextDays = days) => {
    setDays(nextDays)
    setLoading(true)
    setError('')
    setSnapshot(null)
    setRefresh((value) => value + 1)
  }

  const cards = snapshot ? [
    { label: '방문 수', value: snapshot.totals.sessions, hint: 'GA4 세션', icon: Activity },
    { label: '방문자 수', value: snapshot.totals.users, hint: '기간 내 전체 사용자', icon: Users },
    { label: '페이지 조회', value: snapshot.totals.pageViews, hint: '홈 · 셀럽 · 상품 상세', icon: BarChart3 },
    { label: '상품 클릭', value: snapshot.totals.productClicks, hint: '상품을 선택한 횟수', icon: MousePointer2 },
    { label: '상품 상세 조회', value: snapshot.totals.productViews, hint: '직접 방문 포함', icon: BarChart3 },
    { label: '제휴몰 이동', value: snapshot.totals.affiliateClicks, hint: '보러가기 클릭', icon: ArrowUpRight },
  ] : []
  const maxDaily = Math.max(1, ...(snapshot?.daily.flatMap((day) => [day.sessions, day.productClicks]) ?? []))

  return (
    <section className="analytics-dashboard" aria-labelledby="analytics-heading" aria-busy={loading}>
      <header className="analytics-heading">
        <div><span className="analytics-eyebrow">GOOGLE ANALYTICS 4</span><h2 id="analytics-heading">방문 · 상품 통계</h2><p>방문부터 상품 선택까지, 고객의 관심을 확인하세요.</p></div>
        <button type="button" className="ghost-action" disabled={loading} onClick={() => reload()}><RefreshCw size={16} /> 새로고침</button>
      </header>
      <div className="analytics-toolbar">
        <div className="analytics-periods" role="group" aria-label="통계 기간">
          {([1, 7, 30, 90] as const).map((period) => <button type="button" key={period} aria-pressed={days === period} onClick={() => reload(period)}>{period === 1 ? '오늘' : `최근 ${period}일`}</button>)}
        </div>
        {snapshot && <a href={`https://analytics.google.com/analytics/web/#/p${snapshot.propertyId}/reports/intelligenthome`} target="_blank" rel="noreferrer">GA4에서 보기 <ArrowUpRight size={15} /></a>}
      </div>

      {!hasAnalyticsMeasurementId() && <p className="analytics-notice">방문 수집이 아직 연결되지 않았습니다. VITE_GA_MEASUREMENT_ID 설정 후 다시 빌드·배포해 주세요.</p>}
      {loading && <div className="analytics-placeholder" role="status">Google Analytics 통계를 불러오고 있어요…</div>}
      {error && <div className="analytics-error" role="alert"><strong>통계를 불러올 수 없습니다</strong><p>{error}</p><button type="button" className="ghost-action" onClick={() => reload()}>다시 시도</button></div>}

      {snapshot && <>
        <div className="analytics-cards">{cards.map(({ label, value, hint, icon: Icon }) => <article className="analytics-card" key={label}><span><Icon size={17} /> {label}</span><strong>{number.format(value)}</strong><small>{hint}</small></article>)}</div>
        <section className="analytics-panel" aria-labelledby="analytics-trend-heading">
          <div className="analytics-panel-title"><h3 id="analytics-trend-heading">일별 추이</h3><div className="analytics-legend"><span>방문 수</span><span>상품 클릭</span></div></div>
          <div className="analytics-chart-scroll" tabIndex={0} role="region" aria-label="일별 방문 수와 상품 클릭 차트">
            <div className="analytics-chart" style={{ minWidth: `${Math.max(360, days * 26)}px` }}>
              {snapshot.daily.map((day) => <div className="analytics-chart-day" key={day.date} tabIndex={0} aria-label={`${day.date}: 방문 ${day.sessions}회, 상품 클릭 ${day.productClicks}회`} title={`${day.date}\n방문 ${number.format(day.sessions)} · 상품 클릭 ${number.format(day.productClicks)}`}><div className="analytics-bars"><span style={{ height: `${day.sessions / maxDaily * 100}%` }} /><span style={{ height: `${day.productClicks / maxDaily * 100}%` }} /></div><small>{day.date.slice(5).replace('-', '/')}</small></div>)}
            </div>
          </div>
          <details className="analytics-daily-table"><summary>일별 수치 보기</summary><div className="analytics-table-scroll"><table><thead><tr><th scope="col">날짜</th><th scope="col">방문 수</th><th scope="col">상품 클릭</th></tr></thead><tbody>{snapshot.daily.map((day) => <tr key={day.date}><th scope="row">{day.date}</th><td>{number.format(day.sessions)}</td><td>{number.format(day.productClicks)}</td></tr>)}</tbody></table></div></details>
        </section>
        <section className="analytics-panel" aria-labelledby="analytics-products-heading">
          <div className="analytics-panel-title"><h3 id="analytics-products-heading">상품별 클릭 순위</h3><small>상위 50개 · 클릭 수 기준</small></div>
          {snapshot.products.length ? <div className="analytics-table-scroll"><table><thead><tr><th scope="col">순위</th><th scope="col">상품</th><th scope="col">클릭</th><th scope="col">상세 조회</th></tr></thead><tbody>{snapshot.products.map((product, index) => <tr key={`${product.id}-${product.title}`}><td>{index + 1}</td><th scope="row"><span>{product.title}</span><small>{product.id}</small></th><td>{number.format(product.clicks)}</td><td>{number.format(product.views)}</td></tr>)}</tbody></table></div> : <p className="analytics-placeholder">이 기간에 집계된 상품 활동이 없습니다.</p>}
          {snapshot.productRowCount > 50 && <p className="analytics-footnote">전체 {number.format(snapshot.productRowCount)}개 상품 항목 중 상위 50개입니다. 합계 카드에는 전체 상품이 포함됩니다.</p>}
        </section>
        <p className="analytics-footnote">기준 시간대: {snapshot.timeZone} · 조회: {new Date(snapshot.fetchedAt).toLocaleString('ko-KR')}<br />오늘 데이터는 처리 중일 수 있습니다. GA4 보고서는 반영까지 24~48시간이 걸릴 수 있으며, 광고 차단·브라우저 설정에 따라 일부 방문은 수집되지 않습니다. 상품명 변경 시 같은 상품 ID가 여러 행으로 표시될 수 있습니다.</p>
        {snapshot.limited && <p className="analytics-notice">이 보고서에는 GA4의 기준점·샘플링 또는 일부 데이터 통합이 적용되었습니다. GA4에서 상세 상태를 확인해 주세요.</p>}
      </>}

      <details className="analytics-setup" open={Boolean(error)}><summary>GA4 연결 및 집계 기준</summary><ol><li>GA4 웹 스트림의 측정 ID를 <code>VITE_GA_MEASUREMENT_ID</code>로 등록합니다.</li><li>GA4 속성 ID를 <code>GA_PROPERTY_ID</code>, 서비스 계정 JSON을 <code>GA_SERVICE_ACCOUNT_JSON</code>으로 Netlify에 등록합니다. 비밀키는 서버 환경변수에만 저장합니다.</li><li>Google Analytics Data API를 활성화하고 서비스 계정 이메일에 GA4 속성의 뷰어 권한을 부여합니다.</li><li>웹 스트림 → 향상된 측정 → 페이지 조회에서 페이지 로드와 브라우저 방문 기록 변경 측정을 켭니다. 같은 측정 ID를 GTM 등에 중복 설치하지 않습니다.</li><li>재배포 후 GA4 실시간 / DebugView에서 방문과 상품 클릭 이벤트를 확인합니다.</li></ol><p>방문은 GA4 세션 기준입니다. 상품 클릭은 <code>select_item</code>, 상세 조회는 <code>view_item</code>, 제휴몰 이동은 <code>affiliate_click</code>으로 구분합니다. 구매 완료를 의미하지 않습니다. 관리자 화면·로컬 개발·미리보기 도메인은 기본적으로 수집에서 제외됩니다.</p></details>
    </section>
  )
}
