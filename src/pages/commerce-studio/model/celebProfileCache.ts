import type { CelebAccount, CelebStoryFeed } from './celebStoryTypes'

const STORAGE_PREFIX = 'powerpuffceleb:instagram-profile:v1:'

export function readSavedProfiles(accounts: CelebAccount[]): Record<string, CelebStoryFeed> {
  const profiles: Record<string, CelebStoryFeed> = {}
  for (const account of accounts) {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_PREFIX + account.username) ?? 'null')
      if (!value || typeof value !== 'object') continue
      const saved = value as Record<string, unknown>
      if (saved.username !== account.username || typeof saved.followers !== 'number' || !Number.isSafeInteger(saved.followers)
        || saved.followers < 0 || typeof saved.fetchedAt !== 'string' || !Number.isFinite(Date.parse(saved.fetchedAt))
        || Date.parse(saved.fetchedAt) > Date.now()) continue
      let profileImage = ''
      try {
        const url = new URL(String(saved.profileImage))
        if (url.protocol === 'https:' && !url.username && !url.password
          && ['cdninstagram.com', 'fbcdn.net', 'instagram.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) profileImage = url.href
      } catch { /* 이미지가 없어도 확인된 팔로워 수는 유지합니다. */ }
      profiles[account.username] = { accounts, account, followers: saved.followers, profileImage, fetchedAt: saved.fetchedAt, state: 'stale' }
    } catch { /* 저장 차단·손상된 항목은 다른 계정의 복원을 막지 않습니다. */ }
  }
  return profiles
}

export function saveProfileLocally(profile: CelebStoryFeed) {
  if (!hasFollowerCount(profile) || !profile.fetchedAt || !Number.isFinite(Date.parse(profile.fetchedAt)) || Date.parse(profile.fetchedAt) > Date.now()) return
  try {
    const previous = readSavedProfiles([profile.account])[profile.account.username]
    if (previous?.fetchedAt && Date.parse(previous.fetchedAt) > Date.parse(profile.fetchedAt)) return
    localStorage.setItem(STORAGE_PREFIX + profile.account.username, JSON.stringify({
      username: profile.account.username, followers: profile.followers, profileImage: profile.profileImage, fetchedAt: profile.fetchedAt,
    }))
  } catch { /* 브라우저 저장이 불가능해도 서버의 정상 응답은 표시합니다. */ }
}

function hasFollowerCount(profile: CelebStoryFeed | undefined): profile is CelebStoryFeed & { followers: number } {
  return Boolean(profile && (profile.state === 'ready' || profile.state === 'stale')
    && typeof profile.followers === 'number' && Number.isSafeInteger(profile.followers) && profile.followers >= 0)
}

export function retainProfile(previous: CelebStoryFeed | undefined, next: CelebStoryFeed | undefined): CelebStoryFeed | undefined {
  if (next?.state === 'ready' && hasFollowerCount(next)) return next
  // 서버에서 더 최근에 확인한 저장 값이 오면 브라우저의 과거 저장 값을 갱신합니다.
  if (hasFollowerCount(previous) && hasFollowerCount(next) && previous.account.username === next.account.username
    && Date.parse(next.fetchedAt ?? '') > Date.parse(previous.fetchedAt ?? '')) return next
  // 반복된 실패나 누락된 수치가 이미 확인한 정상 값을 지우지 않도록 유지합니다.
  if (hasFollowerCount(previous) && (!next || previous.account.username === next.account.username)) {
    return { ...previous, state: 'stale', ...(next?.issue ? { issue: next.issue } : {}) }
  }
  if (hasFollowerCount(next)) return next
  if (!next) return undefined
  return { ...next, followers: null, state: next.state === 'ready' || next.state === 'stale' ? 'unavailable' : next.state }
}
