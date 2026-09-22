import { siteOrigin } from './lib/site-origin.ts'

export async function handler(event: { httpMethod: string; headers: Record<string, string | undefined> }) {
  const allowed = event.httpMethod === 'GET' || event.httpMethod === 'HEAD'
  return {
    statusCode: allowed ? 200 : 405,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' },
    body: event.httpMethod === 'HEAD' ? '' : allowed ? [
      'User-agent: *', 'Allow: /', 'Disallow: /secret/', 'Disallow: /blog/secret/',
      `Sitemap: ${siteOrigin(event.headers)}/sitemap.xml`, '',
    ].join('\n') : 'Method not allowed',
  }
}
