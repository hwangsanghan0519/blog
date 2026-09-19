import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const appBase = isGitHubPages ? '/blog/' : '/'
const fallbackSiteUrl = 'https://ssenshop.netlify.app'
const configuredSiteUrl = process.env.VITE_SITE_URL || process.env.URL || fallbackSiteUrl
const siteUrl = configuredSiteUrl.replace(/\/$/, '')

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    {
      name: 'viole-production-site-url',
      transformIndexHtml(html) {
        return html.replaceAll(fallbackSiteUrl, siteUrl)
      },
    },
  ],
})
