import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
const appBase = isGitHubPages ? '/blog/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base: appBase,
  plugins: [react()],
})
