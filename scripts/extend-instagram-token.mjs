import { readFile, writeFile, rename, chmod } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

// 응답·요청 URL·예외 원문에는 비밀값이 포함될 수 있으므로 출력하지 않습니다.
async function graphJson(url, authorization, fetcher) {
  let response, payload
  try {
    response = await fetcher(url, { headers: { authorization: `Bearer ${authorization}` }, signal: AbortSignal.timeout(15_000) })
    payload = await response.json()
  } catch { throw new Error('Meta 연결에 실패했습니다. 기존 토큰은 유지됩니다.') }
  if (!response.ok || payload?.error) {
    if (payload?.error?.code === 190) throw new Error('현재 토큰이 만료되거나 무효화됐습니다. Meta 재인증 후 다시 실행하세요.')
    throw new Error(`Meta 요청 실패 (HTTP ${response.status}). 기존 토큰은 유지됩니다.`)
  }
  return payload
}

export async function exchangeToken(env, fetcher = fetch) {
  const token = env.INSTAGRAM_ACCESS_TOKEN?.trim()
  const appId = env.META_APP_ID?.trim()
  const secret = env.META_APP_SECRET?.trim()
  const userId = env.INSTAGRAM_USER_ID?.trim()
  const version = env.INSTAGRAM_GRAPH_VERSION || 'v26.0'
  if (!token || !appId || !secret || !userId) throw new Error('.env.local에 INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID, META_APP_ID, META_APP_SECRET이 필요합니다.')
  if (!/^\d+$/.test(appId) || !/^\d+$/.test(userId) || !/^v\d+\.0$/.test(version)) throw new Error('앱 ID·Instagram 사용자 ID·API 버전 형식을 확인하세요.')
  const base = `https://graph.facebook.com/${version}/`
  const inspect = async candidate => {
    const url = new URL('debug_token', base)
    url.searchParams.set('input_token', candidate)
    const { data } = await graphJson(url, `${appId}|${secret}`, fetcher)
    if (!data?.is_valid || String(data.app_id) !== appId || data.type !== 'USER') throw new Error('앱에 연결된 유효한 사용자 토큰이 아닙니다. Meta에서 재인증하세요.')
    for (const scope of ['instagram_basic', 'instagram_manage_insights', 'pages_read_engagement']) {
      if (!Array.isArray(data.scopes) || !data.scopes.includes(scope)) throw new Error(`Meta 권한이 부족합니다: ${scope}`)
    }
    return data
  }
  await inspect(token)
  const url = new URL('oauth/access_token', base)
  url.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: secret, fb_exchange_token: token }).toString()
  const exchanged = await graphJson(url, token, fetcher)
  if (typeof exchanged.access_token !== 'string' || !exchanged.access_token || /[\r\n]/.test(exchanged.access_token)) throw new Error('장기 토큰 응답이 올바르지 않습니다.')
  const checked = await inspect(exchanged.access_token)
  const expiry = checked.expires_at
  if (typeof expiry !== 'number' || !Number.isFinite(expiry) || expiry <= Date.now() / 1000 + 24 * 3600) throw new Error('반환된 토큰의 유효기간이 하루 이하입니다. 장기 전환을 확인하세요.')
  // 토큰 정보뿐 아니라 실제 사용 중인 Business Discovery 권한까지 확인합니다.
  const probe = new URL(userId, base)
  probe.searchParams.set('fields', 'business_discovery.username(sooyoungchoi){username,followers_count}')
  const result = await graphJson(probe, exchanged.access_token, fetcher)
  if (result.business_discovery?.username !== 'sooyoungchoi' || !Number.isSafeInteger(result.business_discovery?.followers_count)
    || result.business_discovery.followers_count < 0) throw new Error('장기 토큰으로 실제 팔로워 수를 확인하지 못했습니다. 기존 설정은 유지됩니다.')
  return { token: exchanged.access_token, expiresAt: new Date(expiry * 1000).toISOString(),
    dataAccessExpiresAt: checked.data_access_expires_at ? new Date(checked.data_access_expires_at * 1000).toISOString() : null }
}

export function updateTokenEnvironment(source, result) {
  let updated = source
  for (const [name, value] of Object.entries({ INSTAGRAM_ACCESS_TOKEN: result.token, INSTAGRAM_TOKEN_EXPIRES_AT: result.expiresAt })) {
    const line = `${name}=${JSON.stringify(value)}`
    const expression = new RegExp(`^${name}=.*$`, 'gm')
    updated = expression.test(updated) ? updated.replace(expression, () => line) : `${updated.trimEnd()}\n${line}\n`
  }
  return updated
}

async function main() {
  const path = resolve('.env.local')
  const original = await readFile(path, 'utf8')
  const result = await exchangeToken(loadEnv('development', process.cwd(), ''))
  if (await readFile(path, 'utf8') !== original) throw new Error('실행 중 .env.local이 변경돼 저장을 중단했습니다. 다시 실행하세요.')
  const temporary = `${path}.tmp`
  await writeFile(temporary, updateTokenEnvironment(original, result), { mode: 0o600 })
  await chmod(temporary, 0o600)
  await rename(temporary, path)
  console.log(`장기 토큰 검증 및 로컬 저장 완료. 만료: ${result.expiresAt}`)
  if (result.dataAccessExpiresAt) console.log(`데이터 접근 만료: ${result.dataAccessExpiresAt}`)
  console.log('운영 Netlify 비밀 변수 반영·재배포가 필요합니다. 토큰은 출력하지 않습니다.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error && error.message.startsWith('ENOENT') ? '.env.local을 먼저 설정하세요.' : error.message); process.exitCode = 1 })
}
