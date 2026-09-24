import { getCloudDataEndpoint } from './commerceApi'
import { STORAGE_KEYS } from '../model/config'
import type { AnalyticsDays, AnalyticsSnapshot } from '../model/analyticsTypes'

export async function fetchAnalytics(days: AnalyticsDays, signal: AbortSignal): Promise<AnalyticsSnapshot> {
  const token = window.localStorage.getItem(STORAGE_KEYS.adminToken)
  if (!token) throw new Error('통계를 보려면 관리자 저장 토큰을 등록해 주세요.')

  const endpoint = getCloudDataEndpoint().replace('/blog-data', '/analytics')
  const response = await fetch(`${endpoint}?days=${days}`, {
    cache: 'no-store',
    headers: { 'x-blog-admin-token': token, accept: 'application/json' },
    signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('통계 API에 연결할 수 없습니다. Netlify 함수가 배포되었는지 확인해 주세요.')
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '통계를 불러오지 못했습니다.')
  return result as AnalyticsSnapshot
}
