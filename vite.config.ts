import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://<owner>.github.io/hba1c-tracker/ via GitHub Pages —
  // see .github/workflows/deploy.yml.
  base: process.env.GITHUB_PAGES ? '/hba1c-tracker/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
