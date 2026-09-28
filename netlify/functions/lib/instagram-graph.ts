export type InstagramIssue = 'authentication' | 'permission' | 'rate_limit' | 'account' | 'upstream' | 'invalid_response'

export class InstagramError extends Error {
  issue: InstagramIssue
  retryAfter: number
  constructor(issue: InstagramIssue, retryAfter = 60) {
    super(`Instagram ${issue}`)
    this.issue = issue
    this.retryAfter = retryAfter
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function retrySeconds(response: Response) {
  const header = response.headers.get('retry-after')
  if (!header) return 60
  const seconds = Number(header)
  return Math.min(3600, Math.max(1, Math.ceil(Number.isFinite(seconds) ? seconds : (Date.parse(header) - Date.now()) / 1000) || 60))
}

// Facebook Login으로 연결한 Business Discovery는 Facebook Graph 호스트를 사용합니다.
export async function fetchInstagramProfile(username: string, userId: string, token: string, version: string) {
  const url = new URL(`https://graph.facebook.com/${version}/${userId}`)
  url.searchParams.set('fields', `business_discovery.username(${username}){username,profile_picture_url,followers_count}`)
  for (let attempt = 0; attempt < 2; attempt++) {
    let failure = new InstagramError('upstream')
    let retryable = true
    try {
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4_000) })
      const payload: unknown = await response.json().catch(() => null)
      const error = record(payload) && record(payload.error) ? payload.error : undefined
      const code = Number(error?.code)
      // HTTP 200 응답에도 Graph 오류가 포함될 수 있으므로 본문을 확인합니다.
      if (response.status === 401 || [102, 190].includes(code)) throw new InstagramError('authentication', 300)
      if ([10, 200, 294].includes(code) || response.status === 403) throw new InstagramError('permission', 300)
      if (response.status === 429 || [4, 17, 32, 613, 80002].includes(code)) throw new InstagramError('rate_limit', retrySeconds(response))
      if (response.ok && !error && record(payload) && record(payload.business_discovery)) {
        const profile = payload.business_discovery
        if (typeof profile.username !== 'string' || profile.username.toLowerCase() !== username
          || typeof profile.followers_count !== 'number' || !Number.isSafeInteger(profile.followers_count) || profile.followers_count < 0) {
          throw new InstagramError('invalid_response')
        }
        return { username, followers: profile.followers_count, profileImage: mediaUrl(profile.profile_picture_url), fetchedAt: new Date().toISOString() }
      }
      retryable = response.status >= 500 || response.status === 408 || error?.is_transient === true || [1, 2].includes(code)
      failure = new InstagramError([100, 110, 803].includes(code) ? 'account' : response.ok ? 'invalid_response' : 'upstream')
    } catch (error) {
      if (error instanceof InstagramError) throw error
      // 읽기 요청이므로 타임아웃과 네트워크 오류는 한 번 재시도합니다.
    }
    if (!retryable || attempt === 1) throw failure
    await new Promise(resolve => setTimeout(resolve, 300 + Math.floor(Math.random() * 200)))
  }
  throw new InstagramError('upstream')
}

export function mediaUrl(value: unknown) {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      && ['cdninstagram.com', 'fbcdn.net', 'instagram.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : ''
  } catch { return '' }
}
