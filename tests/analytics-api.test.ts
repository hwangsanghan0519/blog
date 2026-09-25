import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handler, buildSnapshot } from '../netlify/functions/analytics'

const { batchRunReports, close, client } = vi.hoisted(() => {
  const batchRunReports = vi.fn()
  const close = vi.fn(async () => {})
  const client = vi.fn(function () { return { batchRunReports, close } })
  return { batchRunReports, close, client }
})
vi.mock('@google-analytics/data', () => ({ BetaAnalyticsDataClient: client, protos: { google: { analytics: { data: { v1beta: { MetricAggregation: { TOTAL: 1 } } } } } } }))

const row = (metrics: number[], dimensions: string[] = []) => ({ metricValues: metrics.map((value) => ({ value: String(value) })), dimensionValues: dimensions.map((value) => ({ value })) })
const reports = [
  { rows: [row([42, 30, 80])], metadata: { timeZone: 'Asia/Seoul' } },
  { rows: [row([42], ['20260925'])] },
  { rows: [row([5, 10], ['p1', '상품'])], totals: [row([500, 700])], rowCount: 75 },
  { rows: [row([9])] },
  { rows: [row([500], ['20260925'])] },
]
const event = { httpMethod: 'GET', headers: { 'x-blog-admin-token': 'test-admin' }, queryStringParameters: { days: '7' } }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BLOG_ADMIN_TOKEN', 'test-admin')
  vi.stubEnv('GA_PROPERTY_ID', '123456')
  vi.stubEnv('GA_SERVICE_ACCOUNT_JSON', JSON.stringify({ client_email: 'test@example.test', private_key: 'private-never-return' }))
  batchRunReports.mockResolvedValue([{ reports }])
})
afterEach(() => vi.unstubAllEnvs())

describe('GA4 admin API', () => {
  it('allows URL-only access without a browser token', async () => {
    vi.stubEnv('BLOG_ADMIN_TOKEN', '')
    expect((await handler({ ...event, headers: {} })).statusCode).toBe(200)
    expect(client).toHaveBeenCalledOnce()
  })

  it('rejects unsupported methods and arbitrary query periods', async () => {
    expect((await handler({ ...event, httpMethod: 'POST' })).statusCode).toBe(405)
    expect((await handler({ ...event, httpMethod: 'OPTIONS' })).statusCode).toBe(204)
    expect((await handler({ ...event, queryStringParameters: { days: '3650' } })).statusCode).toBe(400)
    expect(client).not.toHaveBeenCalled()
  })

  it('shows configuration errors rather than misleading zero data', async () => {
    vi.stubEnv('GA_PROPERTY_ID', '')
    expect((await handler(event)).statusCode).toBe(503)
    vi.stubEnv('GA_PROPERTY_ID', '123')
    vi.stubEnv('GA_SERVICE_ACCOUNT_JSON', '{bad json}')
    expect((await handler(event)).statusCode).toBe(503)
    expect(client).not.toHaveBeenCalled()
  })

  it('queries the official API with inclusive periods, all-product totals and admin-only responses', async () => {
    const response = await handler(event)
    expect(response.statusCode).toBe(200)
    const data = JSON.parse(response.body)
    expect(data.totals).toEqual({ sessions: 42, users: 30, pageViews: 80, productClicks: 500, productViews: 700, affiliateClicks: 9 })
    expect(data.products).toEqual([{ id: 'p1', title: '상품', clicks: 5, views: 10 }])
    expect(response.headers['cache-control']).toBe('private, no-store')
    const request = batchRunReports.mock.calls[0][0]
    expect(request.property).toBe('properties/123456')
    expect(request.requests).toHaveLength(5)
    expect(request.requests[0].dateRanges).toEqual([{ startDate: '6daysAgo', endDate: 'today' }])
    expect(request.requests[2].metricAggregations).toEqual([1])
    expect(request.requests[2].metrics).toEqual([{ name: 'itemsClickedInList' }, { name: 'itemsViewed' }])
    expect(close).toHaveBeenCalledOnce()
    expect(response.body).not.toContain('private-never-return')
  })

  it.each([[7, 502], [8, 429], [4, 502]])('handles Google error %s safely', async (code, status) => {
    batchRunReports.mockRejectedValue({ code, message: 'private-never-return' })
    const response = await handler(event)
    expect(response.statusCode).toBe(status)
    expect(response.body).not.toContain('private-never-return')
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('GA4 report normalization', () => {
  it('fills missing dates using the property timezone across the UTC day boundary', () => {
    const data = buildSnapshot(reports, 7, '123', new Date('2026-09-24T16:00:00Z'))
    expect(data.daily).toHaveLength(7)
    expect(data.daily[0]).toEqual({ date: '2026-09-19', sessions: 0, productClicks: 0 })
    expect(data.daily[6]).toEqual({ date: '2026-09-25', sessions: 42, productClicks: 500 })
    expect(data.productRowCount).toBe(75)
  })

  it('handles empty reports and exposes thresholding without inventing activity', () => {
    const data = buildSnapshot([{ metadata: { subjectToThresholding: true } }, {}, {}, {}, {}], 1, '123', new Date('2026-09-25T00:00:00Z'))
    expect(data.totals.sessions).toBe(0)
    expect(data.products).toEqual([])
    expect(data.limited).toBe(true)
    expect(data.daily).toEqual([{ date: '2026-09-25', sessions: 0, productClicks: 0 }])
  })
})
