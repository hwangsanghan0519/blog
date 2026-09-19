import { createHash } from 'node:crypto'

type NetlifyEvent = {
  body: string | null
  headers: Record<string, string | undefined>
  httpMethod: string
  queryStringParameters?: Record<string, string | undefined> | null
}

type VoteRankingRow = {
  category?: unknown
  votes?: unknown
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

export async function handler(event: NetlifyEvent) {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, null)

    const voteDay = getKoreanVoteDay()
    if (event.httpMethod === 'GET') {
      const voterId = event.queryStringParameters?.voter?.trim() ?? ''
      const [ranking, votedCategory] = await Promise.all([
        readRanking(),
        isValidVoterId(voterId) ? readTodaysVote(hashVoter(voterId), voteDay) : Promise.resolve(null),
      ])
      return json(200, { ranking, votedCategory, voteDay })
    }

    if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed' })

    const payload = JSON.parse(event.body ?? '{}') as { category?: unknown; voterId?: unknown }
    const category = typeof payload.category === 'string' ? payload.category.trim() : ''
    const voterId = typeof payload.voterId === 'string' ? payload.voterId.trim() : ''
    if (!category || category.length > 80 || !isValidVoterId(voterId)) {
      return json(400, { message: '투표 정보가 올바르지 않습니다.' })
    }

    const categories = await readPublicCategories()
    if (!categories.includes(category)) {
      return json(400, { message: '현재 투표할 수 없는 셀럽입니다.' })
    }

    const voterHash = hashVoter(voterId)
    const existingVote = await readTodaysVote(voterHash, voteDay)
    if (existingVote) {
      return json(200, {
        accepted: false,
        ranking: await readRanking(),
        votedCategory: existingVote,
        voteDay,
      })
    }

    const insertResponse = await supabaseFetch('/rest/v1/celeb_votes?on_conflict=voter_hash,vote_day', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ category, voter_hash: voterHash, vote_day: voteDay }),
    })
    if (!insertResponse.ok) throw new Error(await insertResponse.text())

    const inserted = await insertResponse.json() as unknown[]
    const votedCategory = inserted.length ? category : await readTodaysVote(voterHash, voteDay)
    return json(200, {
      accepted: inserted.length > 0,
      ranking: await readRanking(),
      votedCategory: votedCategory ?? category,
      voteDay,
    })
  } catch (error) {
    return json(500, { message: error instanceof Error ? error.message : '투표 저장소 오류가 발생했습니다.' })
  }
}

async function readRanking() {
  const response = await supabaseFetch('/rest/v1/rpc/get_celeb_vote_ranking', {
    method: 'POST',
    body: '{}',
  })
  if (!response.ok) throw new Error(await response.text())

  const rows = await response.json() as VoteRankingRow[]
  return rows.flatMap((row) => {
    const category = typeof row.category === 'string' ? row.category.trim() : ''
    const votes = typeof row.votes === 'number' ? row.votes : Number(row.votes)
    return category ? [{ category, votes: Number.isFinite(votes) ? votes : 0 }] : []
  })
}

async function readTodaysVote(voterHash: string, voteDay: string) {
  const path = `/rest/v1/celeb_votes?voter_hash=eq.${encodeURIComponent(voterHash)}&vote_day=eq.${voteDay}&select=category&limit=1`
  const response = await supabaseFetch(path)
  if (!response.ok) throw new Error(await response.text())

  const [row] = await response.json() as Array<{ category?: unknown }>
  return typeof row?.category === 'string' ? row.category : null
}

async function readPublicCategories() {
  const response = await supabaseFetch('/rest/v1/blog_content?id=eq.main-summary&select=data&limit=1')
  if (!response.ok) throw new Error(await response.text())

  const [row] = await response.json() as Array<{ data?: { categories?: unknown } }>
  const categories = row?.data?.categories
  return Array.isArray(categories)
    ? categories.filter((category): category is string => typeof category === 'string' && Boolean(category.trim())).map((category) => category.trim())
    : []
}

function getKoreanVoteDay() {
  return new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10)
}

function isValidVoterId(value: string) {
  return value.length >= 16 && value.length <= 120 && /^[a-zA-Z0-9._:-]+$/.test(value)
}

function hashVoter(voterId: string) {
  const salt = process.env.CELEB_VOTE_SALT || readSupabaseServiceRoleKey()
  return createHash('sha256').update(`${salt}:${voterId}`).digest('hex')
}

function supabaseFetch(path: string, init?: RequestInit) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = readSupabaseServiceRoleKey()
  if (!url || !key) throw new Error('Supabase 환경변수가 필요합니다.')

  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
}

function readSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_ROLE_KEY || ''
}
