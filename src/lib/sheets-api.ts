import axios from 'axios'

const SHEETS_API_URL = import.meta.env.VITE_SHEETS_API_URL

export type SheetApiResponse<T = unknown> = {
  success: boolean
  message?: string
} & T

export const formatSheetApiError = (
  message: string | undefined,
  action: string,
) => {
  if (message === 'Unknown action') {
    return `Apps Script is out of date (missing "${action}"). Open Expence Tracker Live → Extensions → Apps Script → paste the latest Code.gs → Deploy → New deployment → copy the /exec URL into .env → restart npm run dev.`
  }

  return message ?? 'Request failed'
}

const sheetsClient = axios.create({
  headers: {
    'Content-Type': 'text/plain;charset=utf-8',
  },
})

export const callSheetApi = async <T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<SheetApiResponse<T>> => {
  if (!SHEETS_API_URL) {
    throw new Error(
      'VITE_SHEETS_API_URL is missing. Add your Apps Script Web App URL to .env',
    )
  }

  let data: SheetApiResponse<T>

  try {
    const response = await sheetsClient.post<SheetApiResponse<T>>(
      SHEETS_API_URL,
      JSON.stringify({ action, ...payload }),
    )
    data = response.data
  } catch (error) {
    if (axios.isAxiosError(error) && typeof error.response?.data === 'string') {
      throw new Error(
        'Google Sheets API returned an invalid response. Redeploy your Apps Script web app and verify VITE_SHEETS_API_URL in .env.',
      )
    }

    throw error
  }

  if (typeof data !== 'object' || data === null || !('success' in data)) {
    throw new Error(
      'Google Sheets API returned an invalid response. Redeploy your Apps Script web app and verify VITE_SHEETS_API_URL in .env.',
    )
  }

  return data
}
