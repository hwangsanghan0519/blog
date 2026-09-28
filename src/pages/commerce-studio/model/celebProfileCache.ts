import type { CelebStoryFeed } from './celebStoryTypes'

function hasFollowerCount(profile: CelebStoryFeed | undefined): profile is CelebStoryFeed & { followers: number } {
  return Boolean(profile && (profile.state === 'ready' || profile.state === 'stale')
    && typeof profile.followers === 'number' && Number.isSafeInteger(profile.followers) && profile.followers >= 0)
}

export function retainProfile(previous: CelebStoryFeed | undefined, next: CelebStoryFeed | undefined): CelebStoryFeed | undefined {
  if (next?.state === 'ready' && hasFollowerCount(next)) return next
  // This is the already displayed value, held in React state until reload.
  // Server cache expiry, missing counts and repeated failures must not erase it.
  if (hasFollowerCount(previous) && (!next || previous.account.username === next.account.username)) {
    return { ...previous, state: 'stale' }
  }
  if (hasFollowerCount(next)) return next
  if (!next) return undefined
  return { ...next, followers: null, state: next.state === 'ready' || next.state === 'stale' ? 'unavailable' : next.state }
}
