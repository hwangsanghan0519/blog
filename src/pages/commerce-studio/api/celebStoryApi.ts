import { getCloudDataEndpoint } from './commerceApi'
import type { CelebStoryFeed } from '../model/celebStoryTypes'

// Authentication belongs to the server connection, not an individual celebrity.
// Keep this across component remounts so roster refreshes cannot restart a failing batch.
let authenticationFailure: { endpoint: string; feed: CelebStoryFeed; retryAt: number } | undefined

export async function fetchCelebStories(username: string, signal: AbortSignal): Promise<CelebStoryFeed> {
  signal.throwIfAborted()
  const endpoint = import.meta.env.DEV ? '/.netlify/functions/celeb-stories' : getCloudDataEndpoint().replace('/blog-data', '/celeb-stories')
  if (authenticationFailure?.endpoint === endpoint && authenticationFailure.retryAt > Date.now()) {
    const account = authenticationFailure.feed.accounts.find(account => account.username === username)
    if (account) return {
      ...authenticationFailure.feed, account, state: 'unavailable',
      followers: null, profileImage: '', fetchedAt: null,
    }
  }
  const response = await fetch(`${endpoint}${username ? `?username=${encodeURIComponent(username)}` : ''}`, {
    headers: { accept: 'application/json' }, signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Stories unavailable')
  const feed = await response.json() as CelebStoryFeed
  if (!Array.isArray(feed.accounts) || !feed.account
    || !['ready', 'stale', 'unconfigured', 'unavailable'].includes(feed.state)) throw new Error('Invalid stories')
  if (feed.issue === 'authentication') {
    authenticationFailure = { endpoint, feed, retryAt: Date.now() + 5 * 60_000 }
  } else if (feed.state === 'ready') {
    authenticationFailure = undefined
  }
  return feed
}
