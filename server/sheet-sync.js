const DEFAULT_SPREADSHEET_ID = '1Lzb36e8SIfV0WPrpjEgr_q9M7CJjKTRbdvRseG6GAF4'
const ALLOWED_ACTIONS = new Set(['listSheets', 'previewSheet'])

const text = (value) => String(value ?? '').trim()

const positiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

const authorizeGroup = async (body, headers, env) => {
  const authorization = text(headers?.authorization)
  const groupId = text(body?.groupId)
  const supabaseUrl = text(env.SUPABASE_URL || env.VITE_SUPABASE_URL)
  const publishableKey = text(
    env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  if (!authorization.startsWith('Bearer ') || !groupId) return false
  if (!supabaseUrl.startsWith('https://') || !publishableKey) return false

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/can_use_sheet_sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: authorization,
      },
      body: JSON.stringify({ p_group_id: groupId }),
    },
  )
  if (!response.ok) return false
  return (await response.json().catch(() => false)) === true
}

export const handleSheetSyncRequest = async (
  body,
  env = process.env,
  headers = {},
) => {
  const action = text(body?.action)
  const endpoint = text(env.SHEET_SYNC_API_URL)
  const spreadsheetId =
    text(env.SHEET_SYNC_SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID

  if (!ALLOWED_ACTIONS.has(action)) {
    return { status: 400, body: { error: 'Unknown sheet sync action.' } }
  }
  if (!(await authorizeGroup(body, headers, env).catch(() => false))) {
    return { status: 401, body: { error: 'Sign in before syncing a sheet.' } }
  }
  if (!endpoint.startsWith('https://script.google.com/macros/s/')) {
    return {
      status: 503,
      body: {
        error:
          'Sheet sync is not connected yet. Add SHEET_SYNC_API_URL to the server environment.',
      },
    }
  }

  const payload = {
    action,
    spreadsheetId,
    page: positiveInteger(body?.page, 1, 100000),
    pageSize: positiveInteger(body?.pageSize, 5, 5),
    search: text(body?.search).slice(0, 120),
    sheetId: text(body?.sheetId),
    secret: text(env.SHEET_SYNC_SECRET),
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow',
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result?.ok === false) {
      return {
        status: response.ok ? 422 : 502,
        body: {
          error:
            text(result?.error) ||
            'Google Sheets did not return a valid response.',
        },
      }
    }
    return { status: 200, body: result?.data ?? result }
  } catch (error) {
    return {
      status: 502,
      body: {
        error:
          error?.name === 'AbortError'
            ? 'Google Sheets took too long to respond. Try again.'
            : 'Could not reach Google Sheets. Check the Apps Script deployment.',
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}
