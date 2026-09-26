import { getCloudDataEndpoint } from './commerceApi'
import type { CelebStoryFeed } from '../model/celebStoryTypes'

export async function fetchCelebStories(username: string, signal: AbortSignal): Promise<CelebStoryFeed> {
  const endpoint = import.meta.env.DEV ? '/.netlify/functions/celeb-stories' : getCloudDataEndpoint().replace('/blog-data', '/celeb-stories')
  const response = await fetch(`${endpoint}${username ? `?username=${encodeURIComponent(username)}` : ''}`, {
    headers: { accept: 'application/json' }, signal,
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Stories unavailable')
  const feed = await response.json() as CelebStoryFeed
  if (!Array.isArray(feed.accounts) || !feed.account
    || !['ready', 'stale', 'unconfigured', 'unavailable'].includes(feed.state)) throw new Error('Invalid stories')
  return feed
}
