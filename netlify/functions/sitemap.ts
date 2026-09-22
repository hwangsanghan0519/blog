import { handler as handleData } from './blog-data.ts'

export async function handler(event: Parameters<typeof handleData>[0]) {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: 'Method not allowed' }
  }
  const result = await handleData({ ...event, httpMethod: 'GET', queryStringParameters: { format: 'sitemap' } })
  if (result.statusCode !== 200) {
    return { statusCode: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '300' }, body: event.httpMethod === 'HEAD' ? '' : 'Sitemap temporarily unavailable' }
  }
  return event.httpMethod === 'HEAD' ? { ...result, body: '' } : result
}
