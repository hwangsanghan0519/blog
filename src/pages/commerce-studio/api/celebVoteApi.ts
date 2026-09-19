import { PRODUCTION_CLOUD_DATA_ENDPOINT } from '../model/config'

const LOCAL_VOTER_KEY = 'ssen-celeb-voter-id-v1'
const VOTE_ENDPOINT = '/.netlify/functions/celeb-votes'

export type CelebVoteRank = {
  category: string
  votes: number
}

export type CelebVoteSnapshot = {
  ranking: CelebVoteRank[]
  votedCategory: string | null
  voteDay: string
}

export type CelebVoteResult = CelebVoteSnapshot & {
  accepted: boolean
}

export function getOrCreateCelebVoterId() {
  const saved = window.localStorage.getItem(LOCAL_VOTER_KEY)
  if (saved) return saved

  const voterId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(LOCAL_VOTER_KEY, voterId)
  return voterId
}

export async function fetchCelebVotes(voterId: string, signal?: AbortSignal) {
  const response = await fetch(`${getCelebVoteEndpoint()}?voter=${encodeURIComponent(voterId)}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal,
  })
  if (!response.ok) throw new Error('투표 현황을 불러오지 못했습니다.')
  return response.json() as Promise<CelebVoteSnapshot>
}

export async function castCelebVote(category: string, voterId: string) {
  const response = await fetch(getCelebVoteEndpoint(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ category, voterId }),
  })
  const result = await response.json() as CelebVoteResult & { message?: string }
  if (!response.ok) throw new Error(result.message || '투표를 저장하지 못했습니다.')
  return result
}

function getCelebVoteEndpoint() {
  if (typeof window === 'undefined') return VOTE_ENDPOINT
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return VOTE_ENDPOINT

  return PRODUCTION_CLOUD_DATA_ENDPOINT.replace('/blog-data', '/celeb-votes')
}
