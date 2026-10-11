import { buildSharePreview } from '../server/share-preview.js'

export default async function handler(request, response) {
  const kind = request.query.kind === 'share' ? 'share' : 'leaderboard'
  const host = request.headers['x-forwarded-host'] || request.headers.host
  const proto = request.headers['x-forwarded-proto'] || 'https'
  const html = await buildSharePreview({
    kind,
    email: request.query.email,
    origin: `${proto}://${host}`,
    env: process.env,
    days: request.query.days,
  })

  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.setHeader('Cache-Control', 'public, max-age=300')
  response.status(200).send(html)
}
