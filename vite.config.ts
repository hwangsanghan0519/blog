import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { canonicalSiteOrigin, SEO_SITE_ORIGIN } from './src/shared/lib/seo-config.ts'
import { resolve } from 'node:path'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const appBase = isGitHubPages ? '/blog/' : '/'
const siteUrl = canonicalSiteOrigin(process.env.VITE_SITE_URL)

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    {
      name: 'celeb-stories-local-api',
      configureServer(server) {
        // Instagram 비밀값은 개발 서버에서만 읽으며 VITE_ 환경변수로 노출하지 않습니다.
        // process.env에 복사하면 .env.local 변경으로 재시작해도 이전 토큰이 우선됩니다.
        const env = loadEnv(server.config.mode, server.config.root, 'INSTAGRAM_')
        // The local storefront reads the published roster, not the static defaults.
        // Match it without copying production database credentials into development.
        let roster: { value: string; expiresAt: number } | undefined
        let rosterRequest: Promise<string> | undefined
        const readPublicRoster = async (): Promise<string> => {
          if (roster && roster.expiresAt > Date.now()) return roster.value
          if (!rosterRequest) {
            rosterRequest = (async () => {
              const result = await fetch(`${SEO_SITE_ORIGIN}/.netlify/functions/blog-data?view=summary`, { signal: AbortSignal.timeout(5_000) })
              if (!result.ok) throw new Error('Published roster unavailable')
              const data = await result.json()
              if (!data || typeof data !== 'object' || !('celebAccounts' in data) || !Array.isArray(data.celebAccounts)) throw new Error('Published roster missing')
              const value = JSON.stringify(data.celebAccounts)
              roster = { value, expiresAt: Date.now() + 60_000 }
              return value
            })().finally(() => { rosterRequest = undefined })
          }
          return rosterRequest
        }
        server.middlewares.use('/.netlify/functions/celeb-stories', async (request, response) => {
          try {
            const { handleCelebStories } = await server.ssrLoadModule('/netlify/functions/celeb-stories.ts')
            const url = new URL(request.url ?? '/', 'http://localhost')
            const localEnv = { ...env, INSTAGRAM_CELEB_ACCOUNTS: env.INSTAGRAM_CELEB_ACCOUNTS || await readPublicRoster(), INSTAGRAM_PROFILE_CACHE_DIR: resolve(server.config.root, '.cache/instagram-profiles') }
            const result = await handleCelebStories({ httpMethod: request.method ?? 'GET', queryStringParameters: Object.fromEntries(url.searchParams) }, localEnv)
            response.writeHead(result.statusCode, result.headers)
            response.end(result.body)
          } catch {
            response.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' })
            response.end(JSON.stringify({ message: '셀럽스토리를 불러오지 못했습니다.' }))
          }
        })
      },
    },
    {
      name: 'powerpuffceleb-production-site-url',
      transformIndexHtml(html) {
        const verification = [
          ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION],
          ['naver-site-verification', process.env.NAVER_SITE_VERIFICATION],
          ['msvalidate.01', process.env.BING_SITE_VERIFICATION],
        ].filter(([, value]) => value && /^[a-zA-Z0-9_-]+$/.test(value))
          .map(([name, value]) => `<meta name="${name}" content="${value}" />`).join('\n')
        return html.replaceAll(SEO_SITE_ORIGIN, siteUrl).replace('</head>', `${verification}\n</head>`)
      },
    },
  ],
})
