export type AnalyticsDays = 1 | 7 | 30 | 90

export type AnalyticsSnapshot = {
  days: AnalyticsDays
  propertyId: string
  timeZone: string
  fetchedAt: string
  totals: { sessions: number; users: number; pageViews: number; productClicks: number; productViews: number; affiliateClicks: number }
  daily: Array<{ date: string; sessions: number; productClicks: number }>
  products: Array<{ id: string; title: string; clicks: number; views: number }>
  productRowCount: number
  limited: boolean
}
