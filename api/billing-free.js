import { chooseFreeSubscription } from '../server/billing.js'

export default async function handler(request, response) {
  if (request.method !== 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  const result = await chooseFreeSubscription(request)
  return response.status(result.status).json(result.body)
}
