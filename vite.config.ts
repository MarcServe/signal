import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Plain `vite` has no `/api/*`. Run `npm run dev:vercel` on this port (default 3000) so Enhance / Stripe routes work while you use :5173.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
