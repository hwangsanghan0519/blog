import { publicHttpUrl } from '../../../src/shared/lib/seo-config.ts'

export function requestOrigin(headers: Record<string, string | undefined>) {
  const host = headers['x-forwarded-host'] ?? headers.host
  const protocol = headers['x-forwarded-proto'] ?? (host?.includes('localhost') || host?.startsWith('127.0.0.1') ? 'http' : 'https')
  const url = host ? publicHttpUrl(`${protocol}://${host}`) : ''
  return url ? new URL(url).origin : 'http://localhost:8888'
}

export function siteOrigin(headers: Record<string, string | undefined>) {
  const configured = publicHttpUrl(process.env.VITE_SITE_URL || process.env.URL)
  return configured ? new URL(configured).origin : requestOrigin(headers)
}
