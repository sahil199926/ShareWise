import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleNotifyRequest } from './server/notify.js'

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
        let body: unknown = {}

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
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), mailApi()],
})
