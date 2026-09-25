import { BetaAnalyticsDataClient, protos } from '@google-analytics/data'
import type { AnalyticsDays, AnalyticsSnapshot } from '../../src/pages/commerce-studio/model/analyticsTypes.ts'

type Report = protos.google.analytics.data.v1beta.IRunReportResponse
type Row = protos.google.analytics.data.v1beta.IRow
type Event = { httpMethod: string; headers: Record<string, string | undefined>; queryStringParameters?: Record<string, string | undefined> | null }
const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
  },
  body: JSON.stringify(body),
})

export async function handler(event: Event) {
  if (event.httpMethod === 'OPTIONS') return json(204, null)
  if (event.httpMethod !== 'GET') return json(405, { message: 'Method not allowed' })

  const rawDays = event.queryStringParameters?.days ?? '30'
  if (!['1', '7', '30', '90'].includes(rawDays)) return json(400, { message: '조회 기간이 올바르지 않습니다.' })
  const days = Number(rawDays) as AnalyticsDays
  const propertyId = process.env.GA_PROPERTY_ID || ''
  if (!/^\d+$/.test(propertyId) || !process.env.GA_SERVICE_ACCOUNT_JSON) {
    return json(503, { message: 'GA4 연결이 필요합니다. Netlify에 GA_PROPERTY_ID와 GA_SERVICE_ACCOUNT_JSON을 설정해 주세요.' })
  }

  let credentials: { client_email: string; private_key: string }
  try {
    credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON)
    if (typeof credentials?.client_email !== 'string' || !credentials.client_email.trim() || typeof credentials?.private_key !== 'string' || !credentials.private_key.trim()) throw new Error('Invalid credentials')
  } catch {
    return json(503, { message: 'GA_SERVICE_ACCOUNT_JSON 설정이 올바르지 않습니다. 서비스 계정 JSON을 확인해 주세요.' })
  }

  const client = new BetaAnalyticsDataClient({
    credentials,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    fallback: true,
  })
  try {
    const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }]
    const metric = (name: string) => ({ name })
    const eventFilter = (value: string) => ({ filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT' as const, value } } })
    const [result] = await client.batchRunReports({
      property: `properties/${propertyId}`,
      requests: [
        { dateRanges, metrics: ['sessions', 'totalUsers', 'screenPageViews'].map(metric) },
        { dateRanges, dimensions: [{ name: 'date' }], metrics: [metric('sessions')], orderBys: [{ dimension: { dimensionName: 'date' } }] },
        {
          dateRanges, dimensions: [{ name: 'itemId' }, { name: 'itemName' }],
          metrics: ['itemsClickedInList', 'itemsViewed'].map(metric),
          metricAggregations: [protos.google.analytics.data.v1beta.MetricAggregation.TOTAL],
          orderBys: [{ metric: { metricName: 'itemsClickedInList' }, desc: true }, { dimension: { dimensionName: 'itemId' } }],
          limit: 50,
        },
        { dateRanges, metrics: [metric('eventCount')], dimensionFilter: eventFilter('affiliate_click') },
        { dateRanges, dimensions: [{ name: 'date' }], metrics: [metric('eventCount')], dimensionFilter: eventFilter('select_item'), orderBys: [{ dimension: { dimensionName: 'date' } }] },
      ],
    }, { timeout: 15_000, retry: null })
    if (result.reports?.length !== 5) throw new Error('Incomplete report')
    return json(200, buildSnapshot(result.reports, days, propertyId))
  } catch (error) {
    const code = (error as { code?: number })?.code
    return json(code === 8 || code === 429 ? 429 : 502, {
      message: code === 7 || code === 16 || code === 401 || code === 403
        ? 'GA4 조회 권한을 확인해 주세요. 서비스 계정을 해당 속성의 뷰어로 추가하고 Google Analytics Data API를 활성화해야 합니다.'
        : code === 8 || code === 429
          ? 'GA4 조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
          : 'GA4 통계를 불러오지 못했습니다. 속성 ID와 서비스 계정 설정을 확인한 뒤 다시 시도해 주세요.',
    })
  } finally {
    await client.close().catch(() => {})
  }
}

function count(row: Row | undefined, index: number) {
  const value = Number(row?.metricValues?.[index]?.value ?? 0)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export function buildSnapshot(reports: Report[], days: AnalyticsDays, propertyId: string, now = new Date()): AnalyticsSnapshot {
  const [summary, daily, products, affiliate, clicks] = reports
  const timeZone = summary.metadata?.timeZone || 'Asia/Seoul'
  const dateParts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => dateParts.find((value) => value.type === type)!.value
  const end = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)
  const sessionsByDate = new Map(daily.rows?.map((row) => [row.dimensionValues?.[0]?.value, count(row, 0)]))
  const clicksByDate = new Map(clicks.rows?.map((row) => [row.dimensionValues?.[0]?.value, count(row, 0)]))
  return {
    days, propertyId, timeZone, fetchedAt: now.toISOString(),
    totals: {
      sessions: count(summary.rows?.[0], 0), users: count(summary.rows?.[0], 1), pageViews: count(summary.rows?.[0], 2),
      productClicks: count(products.totals?.[0], 0), productViews: count(products.totals?.[0], 1), affiliateClicks: count(affiliate.rows?.[0], 0),
    },
    daily: Array.from({ length: days }, (_, index) => {
      const date = new Date(end.getTime() - (days - index - 1) * 86_400_000).toISOString().slice(0, 10)
      const key = date.replaceAll('-', '')
      return { date, sessions: sessionsByDate.get(key) ?? 0, productClicks: clicksByDate.get(key) ?? 0 }
    }),
    products: (products.rows ?? []).map((row) => ({
      id: row.dimensionValues?.[0]?.value || '', title: row.dimensionValues?.[1]?.value || '(이름 없음)',
      clicks: count(row, 0), views: count(row, 1),
    })),
    productRowCount: products.rowCount ?? 0,
    limited: reports.some((report) => Boolean(report.metadata?.subjectToThresholding || report.metadata?.dataLossFromOtherRow || report.metadata?.samplingMetadatas?.length)),
  }
}
