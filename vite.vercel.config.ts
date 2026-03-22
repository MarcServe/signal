import path from 'node:path'
import { defineConfig } from 'vite'
import { getVercelEntries } from 'vite-plugin-vercel'
import vercel from 'vite-plugin-vercel/vite'

/**
 * Second build step: emits `.vercel/output` (single `/api/*` function + static).
 * Copies `dist/` (from the prior `vite build`) into `.vercel/output/static` via `environments.client`.
 */
const apiRoot = path.resolve(process.cwd(), 'api')
const allApiEntries = await getVercelEntries('api', { destination: 'api' })
const apiEntries = allApiEntries.filter((e) => {
  const rel = path.relative(apiRoot, e.id)
  return Boolean(rel && !rel.startsWith('..') && !rel.includes(path.sep))
})

export default defineConfig({
  plugins: vercel({
    entries: apiEntries,
    defaultMaxDuration: 60,
    rewrites: [{ source: '/((?!api/).*)', destination: '/index.html' }],
  }),
  environments: {
    client: {
      consumer: 'client',
      build: {
        outDir: 'dist',
      },
    },
  },
})
