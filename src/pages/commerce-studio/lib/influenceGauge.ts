/**
 * 초반 참여는 즉시 체감되고, 이후에는 달성 난도가 점점 높아지는 INFL 게이지입니다.
 * 1~10표는 표당 3%, 10표 이후는 로그 곡선으로 1,000표에서 99%에 도달합니다.
 */
export function getInfluenceGauge(votes: number) {
  if (!Number.isFinite(votes) || votes <= 0) return 0
  if (votes <= 10) return Math.round(votes * 3)

  const logarithmicProgress = Math.log10(votes / 10) / Math.log10(100)
  return Math.min(99, Math.round(30 + (69 * logarithmicProgress)))
}
