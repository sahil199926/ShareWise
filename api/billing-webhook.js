import { subscriptionWebhook } from '../server/billing.js'

export const config = { api: { bodyParser: false } }

export default async function handler(request, response) {
  if (request.method !== 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1024 * 1024)
      return response.status(413).json({ error: 'Payload too large' })
    chunks.push(chunk)
  }
  const result = await subscriptionWebhook(
    Buffer.concat(chunks),
    request.headers['x-razorpay-signature'],
  )
  return response.status(result.status).json(result.body)
}
