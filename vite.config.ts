import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleNotifyRequest } from './server/notify.js'
import { handleSheetSyncRequest } from './server/sheet-sync.js'
import { buildSharePreview, isShareCrawler } from './server/share-preview.js'

const mailApi = (): Plugin => ({
  name: 'karja-mail-api',
  configureServer(server) {
    server.middlewares.use('/api/notify-debt', (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      const chunks: Buffer[] = []
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      req.on('end', () => {
        const env = loadEnv(server.config.mode, process.cwd(), '')
        let body: unknown

        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'This mail request is not valid.' }))
          return
        }

        void handleNotifyRequest(body, env)
          .then((result) => {
            res.statusCode = result.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result.body))
          })
          .catch(() => {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'The email could not be sent.' }))
          })
      })
    })

    server.middlewares.use('/api/sheet-sync', (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      const chunks: Buffer[] = []
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      req.on('end', () => {
        const env = loadEnv(server.config.mode, process.cwd(), '')
        let body: unknown

        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'This sheet request is not valid.' }))
          return
        }

        void handleSheetSyncRequest(body, env).then((result) => {
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        })
      })
    })

    server.middlewares.use((req, res, next) => {
      const userAgent = req.headers['user-agent']
      if (
        !isShareCrawler(Array.isArray(userAgent) ? userAgent[0] : userAgent)
      ) {
        next()
        return
      }

      const url = new URL(req.url ?? '/', 'http://localhost')
      const match = url.pathname.match(/^\/(leaderboard|share)\/([^/]+)$/)
      if (!match) {
        next()
        return
      }

      const env = loadEnv(server.config.mode, process.cwd(), '')
      void buildSharePreview({
        kind: match[1] === 'share' ? 'share' : 'leaderboard',
        email: match[2],
        origin: 'http://localhost:5173',
        env,
        days: url.searchParams.get('days') ?? undefined,
      })
        .then((html) => {
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        })
        .catch(() => {
          next()
        })
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), mailApi()],
})
