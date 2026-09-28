// Public endpoint only: never read or print credentials.
const origin = new URL(process.argv[2] || 'https://powerpuffceleb.co.kr')
const endpoint = new URL('/.netlify/functions/celeb-stories', origin)
const explanations = {
  unconfigured: '배포 서버의 INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID / INSTAGRAM_GRAPH_VERSION 설정을 확인하세요.',
  unavailable: '토큰 만료·권한 또는 해당 계정의 Business Discovery 조회 가능 여부를 확인하세요.',
  stale: '최근 확인한 수치입니다. 현재 API 연결을 확인하세요.',
}

async function read(username) {
  const url = new URL(endpoint)
  if (username) url.searchParams.set('username', username)
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('함수에서 JSON을 반환하지 않습니다. 배포 경로를 확인하세요.')
  const feed = await response.json()
  if (!feed.account || !Array.isArray(feed.accounts) || !['ready', 'stale', 'unconfigured', 'unavailable'].includes(feed.state)) {
    throw new Error(`프로필 응답을 확인할 수 없습니다 (HTTP ${response.status}).`)
  }
  return feed
}

function report(feed) {
  const valid = typeof feed.followers === 'number' && Number.isFinite(feed.followers) && feed.followers >= 0
  console.log(`${feed.account.name} (@${feed.account.username}): ${feed.state} · 팔로워 ${valid ? feed.followers.toLocaleString('ko-KR') : '확인 불가'}`)
  if (feed.issue === 'authentication') console.log('  Meta 인증이 만료되거나 무효화되었습니다. 유효한 장기 토큰으로 교체해야 합니다. 새로고침으로 복구되지 않습니다.')
  else if (explanations[feed.state]) console.log(`  ${explanations[feed.state]}`)
  if (feed.state !== 'ready' || !valid) process.exitCode = 1
}

try {
  console.log(`Instagram 연결 확인: ${endpoint.origin}`)
  const first = await read()
  if (!first.accounts.length) throw new Error('등록된 셀럽 계정이 없습니다.')
  report(first)
  // A missing server configuration affects the whole roster; one request is sufficient.
  if (first.state !== 'unconfigured') {
    for (const account of first.accounts) {
      if (account.username !== first.account.username) report(await read(account.username))
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '연결 확인 실패')
  process.exitCode = 1
}
