import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { canonicalSiteOrigin, SEO_SITE_ORIGIN } from './src/shared/lib/seo-config.ts'

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
        const env = loadEnv(server.config.mode, server.config.root, 'INSTAGRAM_')
        for (const [key, value] of Object.entries(env)) process.env[key] ??= value
        server.middlewares.use('/.netlify/functions/celeb-stories', async (request, response) => {
          try {
            const { handler } = await server.ssrLoadModule('/netlify/functions/celeb-stories.ts')
            const url = new URL(request.url ?? '/', 'http://localhost')
            const result = await handler({ httpMethod: request.method ?? 'GET', queryStringParameters: Object.fromEntries(url.searchParams) })
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
