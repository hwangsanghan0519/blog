import type { CelebStoryFeed } from './celebStoryTypes'

const MAX_AGE = 60 * 60_000
export function retainProfile(previous: CelebStoryFeed | undefined, next: CelebStoryFeed | undefined, now = Date.now()): CelebStoryFeed | undefined {
  if (next?.state === 'ready' && next.followers != null) return next
  if (previous?.fetchedAt && (previous.state === 'ready' || previous.state === 'stale')
    && now >= Date.parse(previous.fetchedAt) && now - Date.parse(previous.fetchedAt) < MAX_AGE
    && (!next || previous.account.username === next.account.username)) return { ...previous, state: 'stale' }
  return next
}
