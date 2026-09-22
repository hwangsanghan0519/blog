import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
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
