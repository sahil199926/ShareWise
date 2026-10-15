import { handleSheetSyncRequest } from '../server/sheet-sync.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const result = await handleSheetSyncRequest(
    request.body,
    process.env,
    request.headers,
  )
  response.status(result.status).json(result.body)
}
