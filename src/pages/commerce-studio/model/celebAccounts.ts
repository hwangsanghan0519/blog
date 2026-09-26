import type { CelebAccount } from './celebStoryTypes'

// 운영 상품에 등록된 Instagram 프로필 출처를 기준으로 연결합니다.
// 관리자에 저장된 목록이 있으면 기본 목록을 대체합니다.
export const DEFAULT_CELEB_ACCOUNTS: CelebAccount[] = [
  { name: '수영', username: 'sooyoungchoi' },
  { name: '한소희', username: 'xeesoxee' },
  { name: '채령', username: 'chaerrry0' },
  { name: '윈터', username: 'imwinter' },
  { name: '예지', username: 'yezyizhere' },
]

export function parseCelebAccounts(value: unknown): CelebAccount[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error('셀럽은 최대 30명까지 등록할 수 있어요.')
  const accounts = value.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string' || typeof item.username !== 'string') throw new Error('이름과 인스타 아이디를 입력해 주세요.')
    const name = item.name.trim()
    const username = item.username.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0].replace(/^@/, '').toLowerCase()
    if (!name || name.length > 50 || !/^[a-z0-9_][a-z0-9_.]{0,29}$/.test(username)) throw new Error('이름과 올바른 인스타 아이디를 입력해 주세요.')
    return { name, username }
  })
  if (new Set(accounts.map(a => a.username)).size !== accounts.length || new Set(accounts.map(a => a.name)).size !== accounts.length) throw new Error('같은 셀럽 이름이나 아이디가 중복되어 있어요.')
  return accounts
}

export function normalizeCelebAccounts(value: unknown): CelebAccount[] {
  if (value === undefined) return DEFAULT_CELEB_ACCOUNTS
  try { return parseCelebAccounts(value) } catch { return DEFAULT_CELEB_ACCOUNTS }
}

export function formatFollowers(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count) || count < 0) return '???'
  if (count < 10_000) return Math.floor(count).toLocaleString('ko-KR')
  const unit = count >= 99_995_000 ? '억' : '만'
  return `${(count / (unit === '억' ? 100_000_000 : 10_000)).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}${unit}`
}
