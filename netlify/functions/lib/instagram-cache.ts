import { mediaUrl, record } from './instagram-graph.ts'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export type ProfileSnapshot = { username: string; followers: number; profileImage: string; fetchedAt: string }
export type StorageEnvironment = Partial<Record<'SUPABASE_URL' | 'VITE_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'SUPABASE_SERVICE_KEY' | 'SERVICE_ROLE_KEY' | 'INSTAGRAM_PROFILE_CACHE_DIR', string>>

function validSnapshot(value: unknown, username: string): ProfileSnapshot | undefined {
  if (!record(value) || value.username !== username || typeof value.followers !== 'number'
    || !Number.isSafeInteger(value.followers) || value.followers < 0 || typeof value.fetchedAt !== 'string') return undefined
  const age = Date.now() - Date.parse(value.fetchedAt)
  if (!Number.isFinite(age) || age < 0) return undefined
  return { username, followers: value.followers, profileImage: mediaUrl(value.profileImage), fetchedAt: value.fetchedAt }
}

function localFile(username: string, env: StorageEnvironment) {
  return env.INSTAGRAM_PROFILE_CACHE_DIR && /^[a-z0-9_][a-z0-9_.]{0,29}$/.test(username)
    ? join(env.INSTAGRAM_PROFILE_CACHE_DIR, `${username}.json`) : undefined
}

function connection(username: string, env: StorageEnvironment) {
  const origin = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SERVICE_ROLE_KEY
  if (!origin || !key) return undefined
  return {
    // 기존 공개 버킷에는 공개 프로필 값만 저장하고 인증 정보는 저장하지 않습니다.
    url: `${origin.replace(/\/$/, '')}/storage/v1/object/blog-assets/instagram-profiles/${encodeURIComponent(username)}.json`,
    headers: { apikey: key, authorization: `Bearer ${key}` },
  }
}

export async function readProfileSnapshot(username: string, env: StorageEnvironment): Promise<ProfileSnapshot | undefined> {
  const file = localFile(username, env)
  if (file) {
    try {
      const snapshot = validSnapshot(JSON.parse(await readFile(file, 'utf8')), username)
      if (snapshot) return snapshot
    } catch { /* 개발 서버의 첫 조회에는 저장 파일이 없습니다. */ }
  }
  const store = connection(username, env)
  if (!store) return undefined
  try {
    const response = await fetch(store.url, { headers: { ...store.headers, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(1_000) })
    if (!response.ok) return undefined
    const value: unknown = await response.json()
    return validSnapshot(value, username)
  } catch { return undefined }
}

export async function saveProfileSnapshot(snapshot: ProfileSnapshot, env: StorageEnvironment) {
  const validated = validSnapshot(snapshot, snapshot.username)
  if (!validated) return
  const body = JSON.stringify(validated)
  const file = localFile(snapshot.username, env)
  if (file) {
    try {
      await mkdir(env.INSTAGRAM_PROFILE_CACHE_DIR!, { recursive: true })
      // 저장 중 재시작해도 기존 정상 파일이 잘리지 않도록 원자적으로 교체합니다.
      const temporary = `${file}.${randomUUID()}.tmp`
      await writeFile(temporary, body, { mode: 0o600 })
      await rename(temporary, file)
    } catch { console.warn('Instagram local snapshot storage unavailable') }
  }
  const store = connection(snapshot.username, env)
  if (!store) return
  try {
    const response = await fetch(store.url, {
      method: 'POST', headers: { ...store.headers, 'content-type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=0' },
      body, signal: AbortSignal.timeout(1_000),
    })
    if (!response.ok) console.warn('Instagram snapshot write unavailable', response.status)
  } catch { console.warn('Instagram snapshot storage unavailable') }
}
