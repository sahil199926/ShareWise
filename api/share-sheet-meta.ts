import {
  buildShareMetaDescription,
  buildShareMetaTitle,
} from '../lib/share-meta'

type ShareSheetResponse = {
  success: boolean
  message?: string
  sheet?: {
    name: string
    users: string[]
    summary: {
      pending: Record<string, number>
    }
  }
}

const DEFAULT_TITLE = 'ShareWise'
const DEFAULT_DESCRIPTION =
  'Track and manage shared expenses with your team. View balances and expenses on this shared sheet.'

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const getSheetsApiUrl = () =>
  process.env.VITE_SHEETS_API_URL ?? process.env.SHEETS_API_URL

const fetchSharedSheet = async (sheetId: string) => {
  const apiUrl = getSheetsApiUrl()

  if (!apiUrl) {
    return null
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'getSharedExpenseSheet',
      sheetId,
    }),
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as ShareSheetResponse

  if (!data.success || !data.sheet) {
    return null
  }

  return data.sheet
}

const buildMetaHtml = ({
  title,
  description,
  shareUrl,
  imageUrl,
}: {
  title: string
  description: string
  shareUrl: string
  imageUrl: string
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(shareUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:site_name" content="ShareWise" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(shareUrl)}" />
  </head>
  <body>
    <p><a href="${escapeHtml(shareUrl)}">${escapeHtml(title)}</a></p>
  </body>
</html>`

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const sheetId = url.searchParams.get('id')?.trim()

  const host = request.headers.get('host') ?? 'share-wise-eonlint.vercel.app'
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = `${protocol}://${host}`
  const imageUrl = `${origin}/shereWise.png`

  if (!sheetId) {
    const html = buildMetaHtml({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      shareUrl: origin,
      imageUrl,
    })

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }

  const shareUrl = `${origin}/share-sheet/${sheetId}`

  try {
    const sheet = await fetchSharedSheet(sheetId)

    if (!sheet) {
      const html = buildMetaHtml({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        shareUrl,
        imageUrl,
      })

      return new Response(html, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      })
    }

    const title = buildShareMetaTitle(sheet.name)
    const description = buildShareMetaDescription(
      sheet.users,
      sheet.summary.pending,
    )

    const html = buildMetaHtml({
      title,
      description,
      shareUrl,
      imageUrl,
    })

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch {
    const html = buildMetaHtml({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      shareUrl,
      imageUrl,
    })

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  }
}

export const config = {
  runtime: 'edge',
}
