import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const appBase = isGitHubPages ? '/blog/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Blog Bazaar',
        short_name: 'BlogBazaar',
        description: 'A private React TypeScript PWA blog studio with local-first editing.',
        theme_color: '#ff6a00',
        background_color: '#f5f6f8',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: appBase,
        icons: [
          {
            src: `${appBase}favicon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
