import { buildSharePreview } from '../server/share-preview.js'

export default async function handler(request, response) {
  const host = request.headers['x-forwarded-host'] || request.headers.host
  const proto = request.headers['x-forwarded-proto'] || 'https'
  const html = await buildSharePreview({
    token: request.query.token,
    origin: `${proto}://${host}`,
    env: process.env,
  })

  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.setHeader('Cache-Control', 'public, max-age=300')
  response.status(200).send(html)
}
