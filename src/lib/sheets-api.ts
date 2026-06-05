import axios from 'axios'

const SHEETS_API_URL = import.meta.env.VITE_SHEETS_API_URL

export type SheetApiResponse<T = unknown> = {
  success: boolean
  message?: string
} & T

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

  const { data } = await sheetsClient.post<SheetApiResponse<T>>(
    SHEETS_API_URL,
    JSON.stringify({ action, ...payload }),
  )

  return data
}
