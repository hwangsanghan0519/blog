import { getCloudDataEndpoint } from './commerceApi'
import type { AnalyticsDays, AnalyticsSnapshot } from '../model/analyticsTypes'

export async function fetchAnalytics(days: AnalyticsDays, signal: AbortSignal): Promise<AnalyticsSnapshot> {
  const endpoint = getCloudDataEndpoint().replace('/blog-data', '/analytics')
  const response = await fetch(`${endpoint}?days=${days}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('통계 API에 연결할 수 없습니다. Netlify 함수가 배포되었는지 확인해 주세요.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '통계를 불러오지 못했습니다.')
  return result as AnalyticsSnapshot
}
