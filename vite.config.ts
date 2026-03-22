import path from 'node:path'
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getVercelEntries } from 'vite-plugin-vercel'
import vercel from 'vite-plugin-vercel/vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // With `npm run dev:all` or `npm run dev` + `npm run dev:vercel`, proxy `/api` to Vercel. Override if needed.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000'

  const plugins: PluginOption[] = [react(), tailwindcss()]
  if (command === 'build') {
    const apiRoot = path.resolve(process.cwd(), 'api')
    const allApiEntries = await getVercelEntries('api', { destination: 'api' })
    const apiEntries = allApiEntries.filter((e) => {
      const rel = path.relative(apiRoot, e.id)
      return Boolean(rel && !rel.startsWith('..') && !rel.includes(path.sep))
    })
    plugins.push(
      vercel({
        entries: apiEntries,
        defaultMaxDuration: 60,
        rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
      })
    )
  }

  return {
    plugins,
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
