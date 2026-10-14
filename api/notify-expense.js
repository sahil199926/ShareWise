import { handleNotifyExpenseRequest } from '../server/notify-expense.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const result = await handleNotifyExpenseRequest(request.body)
  response.status(result.status).json(result.body)
}
